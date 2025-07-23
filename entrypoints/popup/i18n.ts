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

// 同步初始化 i18n，避免异步导致的渲染问题
i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en', // 默认语言
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

// 异步加载保存的语言设置
const loadStoredLanguage = async () => {
    try {
        const result = await browser.storage.local.get('language');
        if (result.language && result.language !== i18n.language) {
            await i18n.changeLanguage(result.language);
        }
    } catch (error) {
        console.error('加载语言设置失败:', error);
    }
};

// 在i18n初始化完成后加载保存的语言设置
loadStoredLanguage();

export default i18n; 