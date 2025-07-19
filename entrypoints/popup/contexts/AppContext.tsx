import React, { createContext, useContext, useMemo } from 'react';
import { AppContextType, AppContextState } from '../types';
import { detectPlatform, isAppleDevice, getShortcutKeys } from '../utils/platform';

// 创建Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider组件属性接口
interface AppProviderProps {
    children: React.ReactNode;
}

// App Context Provider组件
export function AppProvider({ children }: AppProviderProps) {
    // 计算应用状态
    const appState: AppContextState = useMemo(() => {
        const platform = detectPlatform();
        const isApple = isAppleDevice(platform);
        const shortcutKeys = getShortcutKeys(platform);

        return {
            platform,
            isAppleDevice: isApple,
            shortcutKeys
        };
    }, []);

    const contextValue: AppContextType = {
        ...appState
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

// 自定义Hook用于使用App Context
export function useAppContext(): AppContextType {
    const context = useContext(AppContext);

    if (!context) {
        throw new Error('useAppContext必须在AppProvider内部使用');
    }

    return context;
} 