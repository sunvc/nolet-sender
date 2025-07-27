import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  manifest: {
    default_locale: 'en',
    permissions: [
      'storage',
      'contextMenus',
      'activeTab',
      'notifications',
      'clipboardRead' // Firefox 不支持 clipboardRead 权限
    ],
    host_permissions: [
      'https://*/*',
      'http://*/*'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';"
    },
    commands: {
      "send-clipboard": {
        "suggested_key": {
          "default": "Ctrl+Shift+8",
          "mac": "Command+Shift+8"
        },
        "description": "__MSG_shortcut_send_clipboard_description__",
        "global": true
      }
    }
  },
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      /*
        如果是 Firefox: 
        1. 移除 global 属性, Firefox 不支持 global 属性
        source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands#browser_compatibility
        2. clipboardRead 也不支持, 实际测试会被忽略所以没必要移除
        3. 需要增加 "browser_specific_settings": {
              "gecko": {
                "id": "bark-sender@uuphy.com",
                "strict_min_version": "109.0"
              }
            };
            source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
      */
      if (wxt.config.browser === 'firefox') {
        if (manifest.commands && manifest.commands['send-clipboard']) {
          delete manifest.commands['send-clipboard'].global;
          manifest.browser_specific_settings = {
            gecko: {
              id: 'bark_sender@uuphy.com',
              strict_min_version: '109.0'
            }
          };
        }
      }
    }
  }
});
