import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { TabValue } from './types';
import { useDevices } from './hooks/useStorage';
import { useTheme } from './hooks/useTheme';
import { AppProvider, useAppContext } from './contexts/AppContext';
import Layout from './components/Layout';
import SendPush from './pages/SendPush';
import History from './pages/History';
import Settings from './pages/Settings';

import './i18n';
import './App.css';

// 主应用组件内容
function AppContent() {
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

  // 创建动态主题
  const theme = createTheme({
    palette: {
      mode: effectiveTheme,
      primary: {
        main: effectiveTheme === 'dark' ? '#90caf9' : '#1976d2',
      },
      secondary: {
        main: effectiveTheme === 'dark' ? '#f48fb1' : '#dc004e',
      },
      background: {
        default: effectiveTheme === 'dark' ? '#121212' : '#ffffff',
        paper: effectiveTheme === 'dark' ? '#1e1e1e' : '#ffffff',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            margin: 0,
            padding: 0,
            overflow: 'hidden',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });

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

  // 如果数据还在加载中, 显示加载状态
  if (devicesLoading || themeLoading || settingsLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Layout
          currentTab={currentTab}
          onTabChange={setCurrentTab}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            加载中...
          </div>
        </Layout>
      </ThemeProvider>
    );
  }

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
