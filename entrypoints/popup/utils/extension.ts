import { detectBrowser } from './platform';

// 打开GitHub页面
export function openGitHub() {
    const url = 'https://github.com/sunvc/nolet-sender';
    window.open(url, '_blank');
}

// 打开商店页面
export function openStoreRating() {
    const browserType = detectBrowser();
    let url = '';

    switch (browserType) {
        case 'chrome':
            url = `https://chrome.google.com/webstore/detail/${browser.runtime.id}`;
            break;
        case 'firefox':
            url = `https://addons.mozilla.org/firefox/addon/bark-sender/`;
            break;
        case 'edge':
            url = `https://microsoftedge.microsoft.com/addons/detail/bark-sender/${browser.runtime.id}`;
            break;
        default:
            url = `https://github.com/sunvc/nolet-sender`;
            break;
    }
    window.open(url, '_blank');
}

// 打开反馈页面
export function openFeedback() {
    const url = 'https://github.com/sunvc/nolet-sender/issues';
    window.open(url, '_blank');
}

export function openTelegramChannel() {
    const url = 'https://t.me/PushToMe';
    window.open(url, '_blank');
}

export function openOfficialWebsite() {
    const url = 'https://bark-sender.uuphy.com';
    window.open(url, '_blank');
}

export function openNoLetApp() {
    const url = 'https://apps.apple.com/app/id6615073345';
    window.open(url, '_blank');
}

export function openNoLetWebsite() {
    const url = 'https://wiki.wzs.app';
    window.open(url, '_blank');
}