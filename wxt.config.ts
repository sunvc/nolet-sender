import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    manifest_version: 3,
    permissions: [
      'storage',
      'contextMenus',
      'activeTab',
      'notifications',
      'clipboardRead',
      'scripting',
      'tabs',
      'offscreen'
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
        "description": "发送剪切板内容到默认设备",
        "global": true
      }
    }
  }
});
