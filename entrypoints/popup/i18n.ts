import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationZH from './locales/zh-CN/translation.json';
import translationZHHK from './locales/zh-HK/translation.json';
import translationZHTW from './locales/zh-TW/translation.json';

const resources = {
    en: {
        translation: translationEN
    },
    'zh-CN': {
        translation: translationZH
    },
    'zh-HK': {
        translation: translationZHHK
    },
    'zh-TW': {
        translation: translationZHTW
    }
};

// 从 storage 中获取语言设置
const getStoredLanguage = async () => {
    try {
        const result = await browser.storage.local.get('language');
        return result.language;
    } catch (error) {
        console.error('获取语言设置失败:', error);
        return null;
    }
};

// 初始化 i18n
const initI18n = async () => {
    const storedLanguage = await getStoredLanguage();

    i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
            resources,
            lng: storedLanguage,
            fallbackLng: {
                'zh-HK': ['zh-TW', 'zh-CN', 'en'],
                'zh-TW': ['zh-HK', 'zh-CN', 'en'],
                'zh-CN': ['en'],
                default: ['en']
            },
            interpolation: {
                escapeValue: false
            },
            detection: {
                order: ['navigator'],
                caches: []
            }
        });
};

initI18n();

export default i18n; 