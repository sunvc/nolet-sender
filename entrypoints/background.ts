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
      // 处理剪切板读取
      handleClipboard()
        .then(result => {
          sendResponse(result);
        })
        .catch(error => {
          sendResponse('');
        });
      return true;
    }
  });

  // 保存历史记录到 chrome.storage.local 进行暂存 ，在打开历史页面时，再从 chrome.storage.local 写入历史记录
  async function saveHistoryRecord(record: any) {
    try {
      // 获取现有历史记录
      const result = await browser.storage.local.get('bark_history');
      const existingHistory = result.bark_history || [];

      // 添加新记录到数组开头（最新的在前面）
      existingHistory.unshift(record);

      // 限制历史记录数量，比如最多保存1000条
      if (existingHistory.length > 1000) {
        existingHistory.splice(1000);
      }

      await browser.storage.local.set({ bark_history: existingHistory });

      console.debug('历史记录已保存:', record);
      console.debug('当前历史记录总数:', existingHistory.length);
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }
  }

  // 生成 UUID 用于历史记录的唯一标识
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 处理剪切板读取
  async function handleClipboard(): Promise<string> {
    try {
      const text = await navigator.clipboard.readText();
      return text || '';
    } catch (error) {
      console.error('读取剪切板失败:', error);
      return '';
    }
  }

  // 监听快捷键命令
  browser.commands.onCommand.addListener(async (command) => {
    console.debug('收到快捷键命令:', command);
    if (command === 'send-clipboard') {
      await handleClipboardShortcut();
    }
  });

  // 处理剪切板快捷键
  async function handleClipboardShortcut() {
    try {
      console.debug('收到全局快捷键触发');

      // 获取默认设备
      const [devicesResult, defaultDeviceResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
      const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];

      if (!defaultDevice) {
        console.debug('未找到默认设备，但仍打开窗口让用户配置');
        // 仍然打开小窗口，让用户可以添加设备，补充 URL 插叙参数（autoAddDevice=true），自动打开添加设备对话框
        await browser.windows.create({
          url: browser.runtime.getURL('/popup.html?mode=window&autoAddDevice=true'),
          type: 'popup',
          width: 380,
          height: 660,
          left: 0,
          top: 0,
          focused: true
        });

        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/128.png',
          title: 'Bark推送',
          message: '未找到默认设备，请先添加设备'
        });
        return;
      }

      // 直接创建小窗口
      console.debug('创建小窗口');
      await browser.windows.create({
        url: browser.runtime.getURL('/popup.html?mode=window'),
        type: 'popup',
        width: 380,
        height: 660,
        left: 0,
        top: 0,
        focused: true
      });

      // 延迟发送消息，确保窗口已经完全加载
      setTimeout(() => {
        // 向窗口发送快捷键触发消息
        browser.runtime.sendMessage({
          action: 'shortcut-triggered',
          defaultDevice: defaultDevice
        }).catch(error => {
          console.debug('发送消息到窗口失败:', error);
          // 如果发送消息失败，显示通知
          browser.notifications.create({
            type: 'basic',
            iconUrl: '/icon/128.png',
            title: 'Bark推送',
            message: `已打开推送窗口，点击"发送剪切板内容"按钮 (默认设备: ${defaultDevice.alias})`
          });
        });
      }, 300); // 给窗口足够时间加载

    } catch (error) {
      console.error('快捷键处理失败:', error);
      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/128.png',
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

      console.debug('Background 发送加密请求到:', apiURL);

      const formData = new URLSearchParams();
      formData.append('iv', iv);
      formData.append('ciphertext', ciphertext);

      // 发送加密请求
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.debug('Background 加密请求成功:', result);
      return result;
    } catch (error) {
      console.error('Background 发送加密推送失败:', error);
      throw error;
    }
  }

  // 监听扩展安装和启动
  browser.runtime.onInstalled.addListener(() => {
    console.debug('Bark 推送助手已安装');
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
    let message = '', title = '', url = '';
    let defaultDevice: any = null;
    let settings: any = {};

    try {
      // 获取默认设备和设置
      const [devicesResult, defaultDeviceResult, settingsResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device'),
        browser.storage.local.get('bark_app_settings')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
      defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];
      settings = settingsResult.bark_app_settings || { enableEncryption: false };

      if (!defaultDevice) {
        console.error('未找到默认设备');
        // 显示通知
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/128.png',
          title: 'Bark推送',
          message: '未找到默认设备，请先添加设备'
        });
        return;
      }

      if (info.menuItemId === 'send-selection' && info.selectionText) {
        message = info.selectionText;
      } else if (info.menuItemId === 'send-page' && tab?.url) {
        title = tab.title || 'Web'; // 网页标题作为推送标题
        message = tab.url; // 网页 URL 作为推送内容
        url = tab.url; // 同时保留url参数
      }

      if (message) {
        const requestTimestamp = Date.now();
        let response: any;
        let method: 'GET' | 'POST' = 'GET';
        let isEncrypted = false;
        let parameters: any[] = [];

        // 根据设置选择发送方式
        if (settings.enableEncryption && settings.encryptionConfig?.key) {
          method = 'POST';
          isEncrypted = true;
          response = await handleSendEncryptedPush(defaultDevice.apiURL, message, settings.encryptionConfig, settings.sound, url, title);
          parameters = [
            { key: 'iv', value: '***' },
            { key: 'ciphertext', value: '***' },
            { key: 'sound', value: settings.sound || '' }
          ];
        } else {
          method = 'GET';
          response = await sendPushMessage(defaultDevice.apiURL, message, settings.sound, url, title);
          parameters = [
            { key: 'message', value: message },
            { key: 'autoCopy', value: '1' },
            { key: 'copy', value: message },
            { key: 'sound', value: settings.sound || '' }
          ];
          if (title) {
            parameters.push({ key: 'title', value: title });
          }
          if (url) {
            parameters.push({ key: 'url', value: url });
          }
        }

        const responseTimestamp = Date.now();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const createdAt = new Date(requestTimestamp).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        // 创建历史记录对象
        const historyRecord = {
          id: Date.now(), // 使用时间戳作为ID
          uuid: generateUUID(),
          timestamp: requestTimestamp,
          body: message,
          apiUrl: defaultDevice.apiURL,
          deviceName: defaultDevice.alias,
          parameters: parameters,
          responseJson: response,
          requestTimestamp: requestTimestamp,
          responseTimestamp: responseTimestamp,
          timezone: timezone,
          method: method,
          title: title || undefined,
          sound: settings.sound || undefined,
          url: url || undefined,
          isEncrypted: isEncrypted,
          createdAt: createdAt
        };

        // 保存历史记录
        await saveHistoryRecord(historyRecord);

        // 显示通知
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/128.png',
          title: 'Bark推送',
          message: `已发送到 ${defaultDevice.alias}`
        });
      }

    } catch (error) {
      console.error('发送推送失败:', error);

      // 即使发送失败也要记录历史
      if (message && defaultDevice) {
        const requestTimestamp = Date.now();
        const errorResponse = {
          code: -1,
          message: error instanceof Error ? error.message : '未知错误',
          timestamp: Date.now()
        };

        const historyRecord = {
          id: Date.now(),
          uuid: generateUUID(),
          timestamp: requestTimestamp,
          body: message,
          apiUrl: defaultDevice.apiURL,
          deviceName: defaultDevice.alias,
          parameters: [],
          responseJson: errorResponse,
          requestTimestamp: requestTimestamp,
          responseTimestamp: Date.now(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          method: 'GET' as const,
          title: title || undefined,
          sound: settings.sound || undefined,
          url: url || undefined,
          isEncrypted: false,
          createdAt: new Date(requestTimestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
        };

        await saveHistoryRecord(historyRecord);
      }

      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/128.png',
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
    console.debug('Background 发送请求到:', requestUrl);

    const response = await fetch(requestUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.debug('Background 请求成功:', result);
    return result;
  }
});
