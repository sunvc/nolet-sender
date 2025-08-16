import { initBackgroundI18n, watchLanguageChanges, getMessage } from './background/i18n-helper';
import { sendPush, getRequestParameters, generateUUID, PushParams, EncryptionConfig } from './shared/push-service';
import { Device } from './popup/types';

export default defineBackground(() => {
  // 初始化 i18n
  initBackgroundI18n();
  watchLanguageChanges();

  // 监听来自popup的消息
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sendPush') {
      handleSendPush(message.apiURL, message.message, message.sound, message.url, message.title, message.uuid, message.authorization, message.useAPIv2, message.devices)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // 保持消息通道开放
    }

    if (message.action === 'sendEncryptedPush') {
      handleSendEncryptedPush(message.apiURL, message.message, message.encryptionConfig, message.sound, message.url, message.title, message.uuid, message.authorization, message.useAPIv2, message.devices)
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

    // 处理来自 content script 的发送内容请求
    if (message.action === 'send_content') {
      console.log('收到发送内容请求:', message.contentType, message.content);

      // 获取默认设备和设置
      Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device'),
        browser.storage.local.get('bark_app_settings')
      ]).then(([devicesResult, defaultDeviceResult, settingsResult]) => {
        const devices = devicesResult.bark_devices || [];
        const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
        const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];
        const settings = settingsResult.bark_app_settings || { enableEncryption: false };

        if (!defaultDevice) {
          console.error(getMessage('device_not_found'));
          browser.notifications.create({
            type: 'basic',
            iconUrl: '/icon/128.png',
            title: getMessage('bark_sender_title'),
            message: getMessage('device_not_found')
          });
          sendResponse({ success: false, error: getMessage('device_not_found') });
          return;
        }

        // 准备发送参数
        let title = message.title || '';
        let content = message.content || '';
        let url = '';

        // 根据内容类型设置 URL
        if (message.contentType === 'image' || message.contentType === 'url') {
          url = message.content;
        }

        // 发送推送
        const pushUuid = generateUUID();
        const pushParams: PushParams = {
          apiURL: defaultDevice.apiURL,
          message: content,
          sound: settings.sound,
          image: message.contentType === 'image' ? message.content : undefined,
          url,
          title,
          uuid: pushUuid,
          useAPIv2: settings.enableApiV2,
          devices: [defaultDevice],
          ...(defaultDevice.authorization && { authorization: defaultDevice.authorization }),
          ...(settings.enableCustomAvatar && settings.barkAvatarUrl && { icon: settings.barkAvatarUrl })
        };

        // 根据设置选择发送方式
        let method: 'GET' | 'POST' = 'GET';
        let isEncrypted = false;

        const sendPushPromise = settings.enableEncryption && settings.encryptionConfig?.key
          ? (method = 'POST', isEncrypted = true, sendPush(pushParams, settings.encryptionConfig, settings.enableApiV2 ? 'v2' : 'v1'))
          : (method = 'GET', sendPush(pushParams, undefined, settings.enableApiV2 ? 'v2' : 'v1'));

        sendPushPromise
          .then(response => {
            console.log('发送成功:', response);

            // 记录历史
            const requestTimestamp = Date.now();
            const parameters = getRequestParameters(pushParams, isEncrypted);
            const historyRecord = {
              id: Date.now(),
              uuid: pushUuid,
              timestamp: requestTimestamp,
              body: content,
              apiUrl: defaultDevice.apiURL,
              deviceName: defaultDevice.alias,
              parameters: parameters,
              responseJson: response,
              requestTimestamp: requestTimestamp,
              responseTimestamp: Date.now(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              method: method,
              title: title || undefined,
              sound: settings.sound || undefined,
              url: url || undefined,
              isEncrypted: isEncrypted,
              createdAt: new Date(requestTimestamp).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }),
              authorization: defaultDevice.authorization
            };

            saveHistoryRecord(historyRecord);

            // 显示通知
            browser.notifications.create({
              type: 'basic',
              iconUrl: '/icon/128.png',
              title: getMessage('bark_sender_title'),
              message: getMessage('sent_to_device', [defaultDevice.alias])
            });

            // 返回成功响应给content script
            sendResponse({ success: true, data: response });
          })
          .catch(error => {
            console.error('发送失败:', error);

            // 记录失败的历史记录
            const requestTimestamp = Date.now();
            const errorResponse = {
              code: -1,
              message: error instanceof Error ? error.message : getMessage('error_unknown'),
              timestamp: Date.now()
            };

            const historyRecord = {
              id: Date.now(),
              uuid: pushUuid,
              timestamp: requestTimestamp,
              body: content,
              apiUrl: defaultDevice.apiURL,
              deviceName: defaultDevice.alias,
              parameters: [],
              responseJson: errorResponse,
              requestTimestamp: requestTimestamp,
              responseTimestamp: Date.now(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              method: method,
              title: title || undefined,
              sound: settings.sound || undefined,
              url: url || undefined,
              isEncrypted: isEncrypted,
              createdAt: new Date(requestTimestamp).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }),
              authorization: defaultDevice.authorization
            };

            saveHistoryRecord(historyRecord);

            browser.notifications.create({
              type: 'basic',
              iconUrl: '/icon/128.png',
              title: getMessage('bark_sender_title'),
              message: getMessage('send_failed_check_network')
            });

            // 返回错误响应给 content script
            sendResponse({ success: false, data: errorResponse });
          });
      });

      return true; // 保持消息通道开放
    }
  });

  // 存储最后一次右键点击的元素信息
  let lastRightClickedElementInfo: any = null;

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

      // console.debug('历史记录已保存:', record);
      // console.debug('当前历史记录总数:', existingHistory.length);
      console.debug(getMessage('save_history_record'), record);
      console.debug(getMessage('current_history_total', [existingHistory.length.toString()]));
    } catch (error) {
      // console.error('保存历史记录失败:', error);
      console.error(getMessage('save_history_failed'), error);
    }
  }

  // 处理剪切板读取
  async function handleClipboard(): Promise<string> {
    try {
      const text = await navigator.clipboard.readText();
      return text || '';
    } catch (error) {
      // console.error('读取剪切板失败:', error);
      console.error(getMessage('read_clipboard_failed'), error);
      return '';
    }
  }

  // 监听快捷键命令
  browser.commands.onCommand.addListener(async (command) => {
    // console.debug('收到快捷键命令:', command);
    console.debug(getMessage('shortcut_triggered'), command);
    if (command === 'send-clipboard') {
      await handleClipboardShortcut();
    }
  });

  // 处理剪切板快捷键
  async function handleClipboardShortcut() {
    try {
      // console.debug('收到全局快捷键触发');
      console.debug(getMessage('shortcut_triggered'));

      // 获取默认设备
      const [devicesResult, defaultDeviceResult] = await Promise.all([
        browser.storage.local.get('bark_devices'),
        browser.storage.local.get('bark_default_device')
      ]);

      const devices = devicesResult.bark_devices || [];
      const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
      const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];

      if (!defaultDevice) {
        // console.debug('未找到默认设备，但仍打开窗口让用户配置');
        console.debug(getMessage('device_not_found_window'));
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
          // title: 'Bark Sender',
          // message: '未找到默认设备，请先添加设备'
          title: getMessage('bark_sender_title'),
          message: getMessage('device_not_found')
        });
        return;
      }

      // 直接创建小窗口
      // console.debug('创建小窗口');
      console.debug(getMessage('creating_small_window'));
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
          // console.debug('发送消息到窗口失败:', error);
          console.debug(getMessage('send_message_to_window_failed', [error.toString()]));
          // 如果发送消息失败，显示通知
          browser.notifications.create({
            type: 'basic',
            iconUrl: '/icon/128.png',
            // title: 'Bark Sender',
            // message: `已打开推送窗口，点击"发送剪切板内容"按钮 (默认设备: ${defaultDevice.alias})`
            title: getMessage('bark_sender_title'),
            message: getMessage('notification_shortcut_with_device', [defaultDevice.alias])
          });
        });
      }, 300); // 给窗口足够时间加载

    } catch (error) {
      // console.error('快捷键处理失败:', error);
      console.error(getMessage('shortcut_processing_failed'), error);
      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/128.png',
        // title: 'Bark Sender',
        // message: '快捷键触发失败，请手动打开扩展'
        title: getMessage('bark_sender_title'),
        message: getMessage('shortcut_processing_failed')
      });
    }
  }

  // 处理推送请求
  async function handleSendPush(apiURL: string, message: string, sound?: string, url?: string, title?: string, uuid?: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }, useAPIv2?: boolean, devices?: Device[]) {
    try {
      // 获取应用设置
      const settingsResult = await browser.storage.local.get('bark_app_settings');
      const settings = settingsResult.bark_app_settings || { enableEncryption: false };

      // 如果没有传入 devices，则创建一个单设备对象
      const singleDevice = authorization ? {
        id: uuid || generateUUID(),
        apiURL,
        deviceKey: apiURL.split('/').filter(Boolean).pop() || '',
        server: new URL(apiURL).origin,
        alias: 'Default Device',
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        authorization
      } : undefined;

      const pushParams: PushParams = {
        apiURL,
        message,
        sound,
        url,
        title,
        uuid,
        useAPIv2,
        devices: devices || (singleDevice ? [singleDevice] : undefined),
        ...(authorization && { authorization }),
        ...(settings.enableCustomAvatar && settings.barkAvatarUrl && { icon: settings.barkAvatarUrl })
      };
      const apiVersion = useAPIv2 ? 'v2' : 'v1';
      const response = await sendPush(pushParams, undefined, apiVersion);
      return response; // 返回PushResponse
    } catch (error) {
      // console.error('Background发送推送失败:', error);
      console.error(getMessage('background_send_push_failed'), error);
      throw error;
    }
  }

  // 处理加密推送请求
  async function handleSendEncryptedPush(apiURL: string, message: string, encryptionConfig: EncryptionConfig, sound?: string, url?: string, title?: string, uuid?: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }, useAPIv2?: boolean, devices?: Device[]) {
    try {
      // 获取应用设置
      const settingsResult = await browser.storage.local.get('bark_app_settings');
      const settings = settingsResult.bark_app_settings || { enableEncryption: false };

      // 如果没有传入 devices，则创建一个单设备对象
      const singleDevice = authorization ? {
        id: uuid || generateUUID(),
        apiURL,
        deviceKey: apiURL.split('/').filter(Boolean).pop() || '',
        server: new URL(apiURL).origin,
        alias: 'Default Device',
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        authorization
      } : undefined;

      const pushParams: PushParams = {
        apiURL,
        message,
        sound,
        url,
        title,
        uuid,
        useAPIv2,
        devices: devices || (singleDevice ? [singleDevice] : undefined),
        ...(authorization && { authorization }),
        ...(settings.enableCustomAvatar && settings.barkAvatarUrl && { icon: settings.barkAvatarUrl })
      };
      const apiVersion = useAPIv2 ? 'v2' : 'v1';
      const response = await sendPush(pushParams, encryptionConfig, apiVersion);
      return response; // 返回 PushResponse
    } catch (error) {
      // console.error('Background 发送加密推送失败:', error);
      console.error(getMessage('background_send_encrypted_push_failed'), error);
      throw error;
    }
  }

  // 监听扩展安装和启动
  browser.runtime.onInstalled.addListener(() => {
    // console.debug('Bark Sender 已安装');
    console.debug(getMessage('extension_installed'));
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
      const settings = settingsResult.bark_app_settings || { enableContextMenu: true, enableInspectSend: true };

      // 老用户没有这项，这里默认启用
      const enableInspectSend = settings.enableInspectSend ?? true; // 是否启用 inspect-send 菜单项

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

      // 根据 enableInspectSend 设置决定 如果开启则使用新版的 inspect-send 否则使用旧版的 send-selection, send-page, send-link
      if (enableInspectSend) {
        browser.contextMenus.create({
          id: 'send-page',
          title: getMessage('send_page_to_device', [defaultDevice.alias]),
          contexts: ['action']
        });
        // 创建新版右键菜单项 - inspect-send
        browser.contextMenus.create({
          id: 'inspect-send',
          title: getMessage('inspect_send', [defaultDevice.alias]),
          contexts: ['all']
        });
      } else {
        // 创建传统右键菜单项 - send-selection, send-page, send-link
        browser.contextMenus.create({
          id: 'send-selection',
          title: getMessage('send_selection_to_device', [defaultDevice.alias]),
          contexts: ['selection']
        });

        browser.contextMenus.create({
          id: 'send-page',
          title: getMessage('send_page_to_device', [defaultDevice.alias]),
          contexts: ['page', 'action']
        });

        // browser.contextMenus.create({
        //   id: 'send-link',
        //   title: getMessage('send_link_to_device', [defaultDevice.alias]),
        //   contexts: ['link']
        // });
      }

    } catch (error) {
      console.error(getMessage('update_context_menus_failed'), error);
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
        // console.error('未找到默认设备');
        console.error(getMessage('device_not_found'));
        // 显示通知
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/128.png',
          // title: 'Bark Sender',
          // message: '未找到默认设备，请先添加设备'
          title: getMessage('bark_sender_title'),
          message: getMessage('device_not_found')
        });
        return;
      }
      console.debug('info', info);
      if (info.menuItemId === 'send-selection' && info.selectionText) {
        message = info.selectionText;
      } else if (info.menuItemId === 'send-page' && tab?.url) {
        title = tab.title || 'Web'; // 网页标题作为推送标题
        message = tab.url; // 网页 URL 作为推送内容
        url = tab.url; // 同时保留url参数
      } else if (info.menuItemId === 'send-link' && info.linkUrl) {
        title = info.linkText || 'Link'; // 链接文本作为推送标题
        message = info.linkUrl; // 链接URL作为推送内容
        url = info.linkUrl; // 同时保留url参数
      }
      //  else if (info.menuItemId === 'send-image' && info.srcUrl) {
      //   title = 'Image'; // 图片标题
      //   message = info.srcUrl; // 图片URL作为推送内容
      //   url = info.srcUrl; // 同时保留url参数
      // }
      else if (info.menuItemId === 'inspect-send') {
        // 打印完整的右键菜单信息到控制台
        console.log('Right Click Context Info:', {
          info,
          tab,
          mediaType: info.mediaType,
          pageUrl: info.pageUrl,
          frameUrl: info.frameUrl,
          srcUrl: info.srcUrl,
          linkUrl: info.linkUrl,
          linkText: info.linkText,
          selectionText: info.selectionText,
          editable: info.editable,
          menuItemId: info.menuItemId,
          modifiers: info.modifiers,
          button: info.button,
          // 添加来自content script的元素信息
          elementInfo: lastRightClickedElementInfo
        });
        // pageUrl 必须是http或者是https协议的 使用正则表达式
        if (info.pageUrl && !info.pageUrl.startsWith('http://') && !info.pageUrl.startsWith('https://')) {
          return;
        }

        // 向 content script 发送消息，显示选择对话框
        if (tab && tab.id) {
          browser.tabs.sendMessage(tab.id, {
            action: 'show_dialog',
            contextInfo: info, // 右键菜单信息
          }).catch(error => {
            // 将URL相关参数存储到storage.local
            const urlData = {
              url: tab.url,
              title: tab.title,
              selectionText: info.selectionText,
              linkText: info.linkText,
              linkUrl: info.linkUrl
            };

            browser.storage.local.set({ bark_url_data: urlData }).then(() => {
              browser.windows.create({
                url: browser.runtime.getURL('/popup.html?mode=window&useUrlDialog=true'),
                type: 'popup',
                width: 380,
                height: 660,
                left: 0,
                top: 0,
                focused: true,
              });
            });
            return;
          });
        }

        return; // 不执行发送操作
      }

      if (message) {
        const requestTimestamp = Date.now();
        let response: any;
        let method: 'GET' | 'POST' = 'GET';
        let isEncrypted = false;
        let parameters: any[] = [];

        const pushUuid = generateUUID(); // 生成 UUID 用于请求参数 做 撤回 / 修改 请求用

        const pushParams: PushParams = {
          apiURL: defaultDevice.apiURL,
          message,
          sound: settings.sound,
          url,
          title,
          uuid: pushUuid,
          useAPIv2: settings.enableApiV2,
          devices: [defaultDevice],
          ...(defaultDevice.authorization && { authorization: defaultDevice.authorization }),
          ...(settings.enableCustomAvatar && settings.barkAvatarUrl && { icon: settings.barkAvatarUrl })
        };

        // 根据设置选择发送方式
        if (settings.enableEncryption && settings.encryptionConfig?.key) {
          method = 'POST';
          isEncrypted = true;
          response = await sendPush(pushParams, settings.encryptionConfig, settings.enableApiV2 ? 'v2' : 'v1');
        } else {
          method = settings.enableApiV2 ? 'POST' : 'GET';
          response = await sendPush(pushParams, undefined, settings.enableApiV2 ? 'v2' : 'v1');
        }

        // 获取请求参数
        parameters = getRequestParameters(pushParams, isEncrypted);

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
          uuid: pushUuid, // 用于后续的 撤回 / 修改 请求
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
          createdAt: createdAt,
          authorization: defaultDevice.authorization
        };

        // 保存历史记录
        await saveHistoryRecord(historyRecord);

        // 显示通知
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/128.png',
          // title: 'Bark Sender',
          // message: `已发送到 ${defaultDevice.alias}`
          title: getMessage('bark_sender_title'),
          message: getMessage('sent_to_device', [defaultDevice.alias])
        });
      }

    } catch (error) {
      // console.error('发送推送失败:', error);
      console.error(getMessage('send_failed_check_network'), error);

      // 即使发送失败也要记录历史
      if (message && defaultDevice) {
        const requestTimestamp = Date.now();
        const errorResponse = {
          code: -1,
          // message: error instanceof Error ? error.message : '未知错误',
          message: error instanceof Error ? error.message : getMessage('error_unknown'),
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
          }),
          authorization: defaultDevice.authorization
        };

        await saveHistoryRecord(historyRecord);
      }

      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/128.png',
        // title: 'Bark Sender',
        // message: '发送失败，请检查网络连接'
        title: getMessage('bark_sender_title'),
        message: getMessage('send_failed_check_network')
      });
    }
  });
});
