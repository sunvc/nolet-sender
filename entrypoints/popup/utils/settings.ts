declare const chrome: typeof browser;

import { AppSettings } from '../types';

// 设置存储键名
const SETTINGS_KEY = 'bark_app_settings';

// 默认设置
const DEFAULT_SETTINGS: AppSettings = {
    enableContextMenu: true,
    themeMode: 'system'
};

// 获取浏览器存储API
async function getStorage() {
    if (typeof browser !== 'undefined' && browser.storage) {
        return browser.storage;
    }
    if (typeof chrome !== 'undefined' && chrome.storage) {
        return chrome.storage;
    }
    throw new Error('无法获取浏览器存储API');
}

// 获取应用设置
export async function getAppSettings(): Promise<AppSettings> {
    try {
        const storage = await getStorage();
        const result = await storage.local.get(SETTINGS_KEY);
        const settings = result[SETTINGS_KEY];
        return settings ? { ...DEFAULT_SETTINGS, ...settings } : DEFAULT_SETTINGS;
    } catch (error) {
        console.error('获取应用设置失败:', error);
        return DEFAULT_SETTINGS;
    }
}

// 保存应用设置
export async function saveAppSettings(settings: AppSettings): Promise<void> {
    try {
        const storage = await getStorage();
        await storage.local.set({ [SETTINGS_KEY]: settings });
        // 触发设置变更事件，通知background更新右键菜单
        await storage.local.set({ 'settings_updated': Date.now() });
    } catch (error) {
        console.error('保存应用设置失败:', error);
        throw error;
    }
}

// 更新单个设置项
export async function updateAppSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
): Promise<void> {
    try {
        const currentSettings = await getAppSettings();
        const newSettings = { ...currentSettings, [key]: value };
        await saveAppSettings(newSettings);
    } catch (error) {
        console.error('更新设置失败:', error);
        throw error;
    }
} 