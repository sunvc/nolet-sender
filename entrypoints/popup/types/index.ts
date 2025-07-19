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

// 应用设置接口
export interface AppSettings {
    enableContextMenu: boolean;
    themeMode: ThemeMode;
}

// 主题模式类型
export type ThemeMode = 'light' | 'dark' | 'system';

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
}

// App上下文接口
export interface AppContextType extends AppContextState {
    // 未来可以在这里添加更多方法
}
