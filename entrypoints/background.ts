export default defineBackground(() => {
  // 监听来自popup的消息
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sendPush') {
      handleSendPush(message.apiURL, message.message, message.sound, message.url, message.title)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放
    }

    if (message.action === 'sendEncryptedPush') {
      handleSendEncryptedPush(message.apiURL, message.message, message.encryptionConfig, message.sound, message.url, message.title)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放
    }

    if (message.action === 'readClipboard') {
      // 在offscreen document中处理剪切板读取
      handleOffscreenClipboard()
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse('');
        });
      return true;
    }
  });

  // 处理offscreen剪切板读取
  async function handleOffscreenClipboard(): Promise<string> {
    try {
      const text = await navigator.clipboard.readText();
      return text || '';
    } catch (error) {
      console.error('Offscreen读取剪切板失败:', error);
      return '';
    }
  }

  // 监听快捷键命令
  browser.commands.onCommand.addListener(async (command) => {
    console.log('收到快捷键命令:', command);
    if (command === 'send-clipboard') {
      await handleClipboardShortcut();
    }
  });

  // 处理剪切板快捷键
  async function handleClipboardShortcut() {
    try {
      console.log('收到全局快捷键触发');

      // 获取默认设备
      const [devicesResult, defaultDeviceResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
      const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];

      if (!defaultDevice) {
        console.log('未找到默认设备');
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/48.png',
          title: 'Bark推送',
          message: '未找到默认设备，请先配置设备'
        });
        return;
      }

      // 尝试打开popup
      let popupOpened = false;
      try {
        await browser.action.openPopup();
        popupOpened = true;
      } catch (error) {
        console.log('无法直接打开popup，创建新窗口');
        // 如果无法直接打开popup，创建一个小窗口
        await browser.windows.create({
          url: browser.runtime.getURL('/popup.html?mode=window'),
          type: 'popup',
          width: 380,
          height: 660,
          left: 0,
          top: 0,
          focused: true
        });
        popupOpened = true;
      }

      if (popupOpened) {
        // 延迟发送消息，确保popup已经完全加载
        setTimeout(() => {
          // 向popup发送快捷键触发消息
          browser.runtime.sendMessage({
            action: 'shortcut-triggered',
            defaultDevice: defaultDevice
          }).catch(error => {
            console.log('发送消息到popup失败:', error);
            // 如果发送消息失败，显示通知
            browser.notifications.create({
              type: 'basic',
              iconUrl: '/icon/48.png',
              title: 'Bark推送',
              message: `已打开推送窗口，点击"发送剪切板内容"按钮 (默认设备: ${defaultDevice.alias})`
            });
          });
        }, 300); // 给popup足够时间加载
      }

    } catch (error) {
      console.error('快捷键处理失败:', error);
      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/48.png',
        title: 'Bark推送',
        message: '快捷键触发失败，请手动打开扩展'
      });
    }
  }

  // 处理推送请求
  async function handleSendPush(apiURL: string, message: string, sound?: string, url?: string, title?: string) {
    try {
      const response = await sendPushMessage(apiURL, message, sound, url, title);
      return response;
    } catch (error) {
      console.error('Background发送推送失败:', error);
      throw error;
    }
  }

  // 处理加密推送请求
  async function handleSendEncryptedPush(apiURL: string, message: string, encryptionConfig: any, sound?: string, url?: string, title?: string) {
    try {
      function generateAsciiString(len: number): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const arr = new Uint8Array(len);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => charset[b % charset.length]).join('');
      }

      function generateIV(): string {
        return generateAsciiString(16);
      }

      function toUtf8Bytes(str: string): Uint8Array {
        return new TextEncoder().encode(str);
      }

      function arrayBufferToBase64(buffer: ArrayBuffer): string {
        const binary = String.fromCharCode(...new Uint8Array(buffer));
        return btoa(binary);
      }

      async function encryptAESCBC(plaintext: string, keyStr: string, ivStr: string): Promise<string> {
        const keyBytes = toUtf8Bytes(keyStr);
        const iv = toUtf8Bytes(ivStr);
        const data = toUtf8Bytes(plaintext);

        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-CBC' },
          false,
          ['encrypt']
        );

        const encryptedBuffer = await crypto.subtle.encrypt(
          {
            name: 'AES-CBC',
            iv: iv
          },
          cryptoKey,
          data
        );

        return arrayBufferToBase64(encryptedBuffer);
      }

      // 生成随机IV
      const iv = generateIV();

      // 构建加密内容
      const encryptData: any = { body: message };
      if (sound) {
        encryptData.sound = sound;
      }
      if (url) {
        encryptData.url = url;
      }
      if (title) {
        encryptData.title = title;
      }

      // 加密消息
      const plaintext = JSON.stringify(encryptData);
      const ciphertext = await encryptAESCBC(plaintext, encryptionConfig.key, iv);

      console.log('Background 发送加密请求到:', apiURL);

      const formData = new URLSearchParams();
      formData.append('iv', iv);
      formData.append('ciphertext', ciphertext);

      // 发送加密请求
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Bark-Sender-Browser-Extension/1.0.0'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Background 加密请求成功:', result);
      return result;
    } catch (error) {
      console.error('Background 发送加密推送失败:', error);
      throw error;
    }
  }

  // 监听扩展安装和启动
  browser.runtime.onInstalled.addListener(() => {
    console.log('Bark推送助手已安装');
    updateContextMenus();
  });

  browser.runtime.onStartup.addListener(() => {
    updateContextMenus();
  });

  // 监听存储变化，动态更新右键菜单
  browser.storage.onChanged.addListener((changes: any) => {
    if (changes.bark_devices || changes.bark_app_settings) {
      updateContextMenus();
    }
  });

  // 更新右键菜单
  async function updateContextMenus() {
    try {
      // 清除所有现有菜单
      browser.contextMenus.removeAll();

      // 获取设置
      const settingsResult = await browser.storage.local.get('bark_app_settings');
      const settings = settingsResult.bark_app_settings || { enableContextMenu: true };

      if (!settings.enableContextMenu) {
        return;
      }

      // 获取设备列表和默认设备
      const [devicesResult, defaultDeviceResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';

      if (devices.length === 0) {
        return;
      }

      // 找到默认设备
      const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];

      // 创建右键菜单项
      browser.contextMenus.create({
        id: 'send-selection',
        title: `发送所选内容给 ${defaultDevice.alias}`,
        contexts: ['selection']
      });

      browser.contextMenus.create({
        id: 'send-page',
        title: `发送页面链接给 ${defaultDevice.alias}`,
        contexts: ['page']
      });

    } catch (error) {
      console.error('更新右键菜单失败:', error);
    }
  }

  // 处理右键菜单点击
  browser.contextMenus.onClicked.addListener(async (info: any, tab: any) => {
    try {
      // 获取默认设备和设置
      const [devicesResult, defaultDeviceResult, settingsResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device'),
        browser.storage.local.get('bark_app_settings')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
      const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];
      const settings = settingsResult.bark_app_settings || { enableEncryption: false };

      if (!defaultDevice) {
        console.error('未找到默认设备');
        return;
      }

      let message = '', title = '', url = '';

      if (info.menuItemId === 'send-selection' && info.selectionText) {
        message = info.selectionText;
      } else if (info.menuItemId === 'send-page' && tab?.url) {
        title = tab.title || 'Web'; // 网页标题作为推送标题
        message = tab.url; // 网页 URL 作为推送内容
        url = tab.url; // 同时保留url参数
      }

      if (message) {
        // 根据设置选择发送方式
        if (settings.enableEncryption && settings.encryptionConfig?.key) {
          await handleSendEncryptedPush(defaultDevice.apiURL, message, settings.encryptionConfig, settings.sound, url, title);
        } else {
          await sendPushMessage(defaultDevice.apiURL, message, settings.sound, url, title);
        }

        // 显示通知
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/48.png',
          title: 'Bark推送',
          message: `已发送到 ${defaultDevice.alias}`
        });
      }

    } catch (error) {
      console.error('发送推送失败:', error);
      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/48.png',
        title: 'Bark推送',
        message: '发送失败，请检查网络连接'
      });
    }
  });

  // 发送推送消息
  async function sendPushMessage(apiURL: string, message: string, sound?: string, url?: string, title?: string) {
    let requestUrl; // 如果有标题则插入到路径中
    if (title) {
      // 含标题格式: https://api.day.app/key/title/body?params
      requestUrl = `${apiURL}${encodeURIComponent(title)}/${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
    } else {
      // 默认的格式: https://api.day.app/key/body?params  
      requestUrl = `${apiURL}${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
    }

    if (sound) {
      requestUrl += `&sound=${encodeURIComponent(sound)}`;
    }
    if (url) {
      requestUrl += `&url=${encodeURIComponent(url)}`;
    }
    console.log('Background 发送请求到:', requestUrl);

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Bark-Browser-Extension/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Background请求成功:', result);
    return result;
  }
});
