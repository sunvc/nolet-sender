declare const chrome: typeof browser;

// 打开扩展快捷键设置页面
export function openExtensionShortcuts() {
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.tabs.create({
            url: 'chrome://extensions/shortcuts'
        }).catch(() => {
            // 如果直接打开失败，尝试打开扩展管理页面
            browser.runtime.openOptionsPage();
        });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.create({
            url: 'chrome://extensions/shortcuts'
        });
    }
}

// 打开GitHub页面
export function openGitHub() {
    const url = 'https://github.com/ij369/bark-sender';
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.tabs.create({ url });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.create({ url });
    }
}

// 打开Chrome商店评分页面
export function openChromeStoreRating() {
    const url = `https://chrome.google.com/webstore/detail/${browser.runtime.id}`;
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.tabs.create({ url });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.create({ url });
    }
}

// 打开反馈页面
export function openFeedback() {
    const url = 'https://github.com/ij369/bark-sender/issues/new';
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.tabs.create({ url });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.create({ url });
    }
}

export function openTelegramChannel() {
    const url = 'https://t.me/bark_sender';
    if (typeof browser !== 'undefined' && browser.runtime) {
        browser.tabs.create({ url });
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.tabs.create({ url });
    }
}