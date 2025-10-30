import { defineConfig } from "wxt";
import * as fs from "fs";
import * as path from "path";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  vite: () => ({
    build: {
      minify: "terser",
      rollupOptions: {
        output: {
          minifyInternalExports: true,
        },
      },
    },
  }),
  manifest: {
    default_locale: "en",
    omnibox: {
      keyword: "bb",
    },
    permissions: [
      "storage",
      "contextMenus",
      "activeTab",
      "notifications",
      "clipboardRead", // Firefox 不支持 clipboardRead 权限
      "identity", // Chrome 特有
    ],
    host_permissions: ["https://*/*", "http://*/*"],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    oauth2: {
      client_id:
        "1015101043935-97vmnmdsqgql2lne6stun1b4lhluhtgc.apps.googleusercontent.com",
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    },
    commands: {
      "send-clipboard": {
        suggested_key: {
          default: "Ctrl+Shift+8",
          mac: "Command+Shift+8",
        },
        description: "__MSG_shortcut_send_clipboard_description__",
        global: true,
      },
    },
  },
  hooks: {
    "build:done": (wxt, output) => {
      // console.log('构建完成, Node 正在处理 content-scripts 中的模版字符串里代码缩进导致的空格');
      const outputDir = path.resolve(process.cwd(), ".output");

      fs.readdirSync(outputDir).forEach((browser) => {
        const browserDir = path.join(outputDir, browser);

        if (fs.statSync(browserDir).isDirectory()) {
          const contentScriptsDir = path.join(browserDir, "content-scripts");

          if (fs.existsSync(contentScriptsDir)) {
            // 处理 content-scripts 目录中的所有 js
            fs.readdirSync(contentScriptsDir).forEach((file) => {
              if (file.endsWith(".js")) {
                const filePath = path.join(contentScriptsDir, file);

                let content = fs.readFileSync(filePath, "utf8");
                const originalContent = content;

                // 处理 \n 后面跟着空格的情况
                content = content.replace(/\\n\s+/g, "");

                // 匹配 css 注释 /* css start */ ... /* css end */ 中间的 css 内容, 并压缩 CSS
                content = content.replace(
                  /\/\*\s*css\s+start\s*\*\/([\s\S]*?)\/\*\s*css\s+end\s*\*\//g,
                  (match, cssContent) => {
                    // 移除 CSS 内容中的所有 \n 并压缩 CSS
                    let processedMatch = match
                      .replace(/\\n/g, "") // 移除所有换行符
                      .replace(/(\s)*{\s*/g, "{") // 压缩花括号前后的空格
                      .replace(/(\s)*}\s*/g, "}") // 压缩花括号后的空格
                      .replace(/(\s)*;\s*/g, ";") // 压缩分号前后的空格
                      .replace(/:(\s)*/g, ":") // 压缩冒号后的空格
                      .replace(/;}/g, "}"); // 移除花括号前的分号
                    // 这里实现参考: https://www.zhangxinxu.com/sp/css-compress-mini.html
                    return processedMatch;
                  }
                );

                // 匹配 /* ... */ css 注释, 移除注释内容
                content = content.replace(/\/\*\s+.+?\s\*\//g, "");

                if (content !== originalContent) {
                  fs.writeFileSync(filePath, content, "utf8");
                  // console.log(`已处理文件: ${filePath}`);
                }
              }
            });
          }

          // hack: 移除不安全的 new Function 调用 (针对 ag-grid@34.2.0)
          const chunksDir = path.join(browserDir, "chunks");
          if (fs.existsSync(chunksDir)) {
            fs.readdirSync(chunksDir).forEach((file) => {
              if (file.endsWith(".js")) {
                const filePath = path.join(chunksDir, file);
                let content = fs.readFileSync(filePath, "utf8");
                const originalContent = content;

                content = content.replace(
                  // /new Function\s*\([^)]*\)/g,
                  /new Function\s*\([^)]*\)/,
                  "function() { return null; }" // ag-grid@34.2.0 的 new Function 调用只产生了一处
                );
                if (content !== originalContent) {
                  fs.writeFileSync(filePath, content, "utf8");
                  console.log(`移除不安全的 new Function 调用: ${filePath}`);
                }
              }
            });
          }
        }
      });
    },
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.mode === "development" && import.meta.env.VITE_DEV_KEY) {
        manifest.key = import.meta.env.VITE_DEV_KEY;
        // https://developer.chrome.com/docs/extensions/how-to/integrate/oauth#upload_to_dashboard
      }
      /*
        如果是 Firefox: 
        1. 移除 global 属性, Firefox 不支持 global 属性
        source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands#browser_compatibility
        2. clipboardRead 也不支持, 实际测试会被忽略所以没必要移除
        3. 需要增加 "browser_specific_settings": {
              "gecko": {
                "id": "nolet-sender@uuphy.com",
                "strict_min_version": "109.0"
              }
            };
            source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
        如果是Edge: 
        移除 identity 和 oauth2，保留其他功能
      */
      if (wxt.config.browser === "firefox") {
        if (manifest.commands && manifest.commands["send-clipboard"]) {
          delete manifest.commands["send-clipboard"].global;
        }

        if (manifest.permissions) {
          manifest.permissions = manifest.permissions.filter(
            (permission: string) => permission !== "identity"
          );
        }

        manifest.browser_specific_settings = {
          gecko: {
            id: "to@wzs.app",
            strict_min_version: "109.0",
          },
        };
      } else if (wxt.config.browser === "edge") {
        if (manifest.permissions) {
          manifest.permissions = manifest.permissions.filter(
            (permission: string) => permission !== "identity"
          );
        }
      } else if (wxt.config.browser === "safari") {
        delete manifest.omnibox;
        manifest.background = {
          scripts: ["background.js"],
          type: "module",
        };
        manifest.action = {
          default_title: "NoLet Sender",
          default_popup: "popup.html",
          default_icon: "icon/logo.svg",
        };
      }

      if (wxt.config.browser !== "chrome") {
        delete manifest.oauth2;
      }
    },
  },
});
