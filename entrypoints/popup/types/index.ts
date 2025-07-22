// 设备信息接口
export interface Device {
    id: string; // 时间戳作为唯一标识
    alias: string; // 设备别名
    apiURL: string; // API URL
    createdAt: string; // 创建时间 YYYY-MM-DD HH:mm:ss
    timestamp: number; // 时间戳
}

// 推送响应接口
export interface PushResponse {
    code: number;
    message: string;
    timestamp: number;
}

// 页面标识
export type TabValue = 'send' | 'history' | 'settings';

// 主题模式类型
export type ThemeMode = 'light' | 'dark' | 'system';

// 加密算法类型
export type EncryptionAlgorithm = 'AES256' | 'AES192' | 'AES128';

// 加密模式类型  
export type EncryptionMode = 'CBC';

// 填充模式类型
export type PaddingMode = 'pkcs7';

// 加密配置接口
export interface EncryptionConfig {
    algorithm: EncryptionAlgorithm;
    mode: EncryptionMode;
    padding: PaddingMode;
    key: string;
}

// 铃声接口
export interface Sound {
    name: string;
    duration: number; // 持续时间 (ms)
    old?: boolean; // 是否为旧铃声
}

// 应用设置接口
export interface AppSettings {
    enableContextMenu: boolean;
    themeMode: ThemeMode;
    enableEncryption: boolean;
    encryptionConfig?: EncryptionConfig;
    sound?: string;
}

// 平台类型
export type PlatformType = 'mac' | 'windows' | 'linux' | 'unknown';

// App上下文状态接口
export interface AppContextState {
    platform: PlatformType;
    isAppleDevice: boolean;
    shortcutKeys: {
        send: string; // 发送快捷键组合
        openExtension: string; // 打开扩展快捷键组合
    };
    // 加密相关
    appSettings: AppSettings | null;
    loading: boolean;
}

// App上下文接口
export interface AppContextType extends AppContextState {
    // 加密相关
    toggleEncryption: () => Promise<void>;
    updateEncryptionConfig: (config: EncryptionConfig) => Promise<void>;
    updateAppSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
    reloadSettings: () => Promise<void>;
    shouldShowEncryptionToggle: boolean;
}
