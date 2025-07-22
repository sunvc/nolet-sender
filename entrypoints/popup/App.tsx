import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useTranslation } from 'react-i18next';
import { TabValue } from './types';
import { useDevices } from './hooks/useStorage';
import { useTheme } from './hooks/useTheme';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { initHistoryService } from './utils/history-service';
import { createAppTheme } from './theme';
import Layout from './components/Layout';
import SendPush from './pages/SendPush';
import History from './pages/History';
import Settings from './pages/Settings';

import './i18n';
import './App.css';

// 主应用组件内容
function AppContent() {
  const { i18n } = useTranslation();
  const [currentTab, setCurrentTab] = useState<TabValue>('send');
  const {
    devices,
    defaultDeviceId,
    loading: devicesLoading,
    addDevice,
    editDevice,
    removeDevice,
    setDefaultDevice,
    getDefaultDevice
  } = useDevices();

  const {
    themeMode,
    effectiveTheme,
    loading: themeLoading,
    updateThemeMode
  } = useTheme();

  const {
    appSettings,
    loading: settingsLoading,
    toggleEncryption,
    shouldShowEncryptionToggle,
    reloadSettings
  } = useAppContext();

  // 初始化历史服务
  useEffect(() => {
    initHistoryService();
  }, []);

  // 检查是否是窗口模式并添加类名
  useEffect(() => {
    const isWindowMode = new URLSearchParams(window.location.search).get('mode') === 'window';
    if (isWindowMode) {
      document.documentElement.classList.add('u-full');
    }
    return () => {
      if (isWindowMode) {
        document.documentElement.classList.remove('u-full');
      }
    };
  }, []);

  // 设置data-theme属性以控制CSS样式
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  // 等待 i18n 和其他资源加载完成
  if (!i18n.isInitialized || devicesLoading || themeLoading || settingsLoading) {
    return (
      <ThemeProvider theme={createAppTheme(effectiveTheme, i18n.language === 'zh' ? 'zh' : 'en')}>
        <CssBaseline />
        {/* 加载中，此时需要等待i18n和其他资源 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '14px',
          color: '#666'
        }}>
          Loading...
        </div>
      </ThemeProvider>
    );
  }

  // 创建动态主题
  const theme = createAppTheme(effectiveTheme, i18n.language === 'zh' ? 'zh' : 'en');

  // 渲染当前页面内容
  const renderCurrentPage = () => {
    switch (currentTab) {
      case 'send':
        return (
          <SendPush
            devices={devices}
            defaultDevice={getDefaultDevice()}
            onAddDevice={addDevice}
          />
        );
      case 'history':
        return <History />;
      case 'settings':
        return (
          <Settings
            devices={devices}
            defaultDeviceId={defaultDeviceId}
            onAddDevice={addDevice}
            onEditDevice={editDevice}
            onRemoveDevice={removeDevice}
            onSetDefaultDevice={setDefaultDevice}
            themeMode={themeMode}
            onThemeChange={updateThemeMode}
            onSettingsChange={reloadSettings}
          />
        );
      default:
        return (
          <SendPush
            devices={devices}
            defaultDevice={getDefaultDevice()}
            onAddDevice={addDevice}
          />
        );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        showEncryptionToggle={shouldShowEncryptionToggle}
        encryptionEnabled={appSettings?.enableEncryption || false}
        onEncryptionToggle={toggleEncryption}
      >
        {renderCurrentPage()}
      </Layout>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
