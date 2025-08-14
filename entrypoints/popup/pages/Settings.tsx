import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Typography,
    Alert,
    Stack,
    Paper,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Radio,
    FormControlLabel,
    Switch,
    Link,
    Tooltip,
    Popover,
    LinearProgress,
    Divider,
    Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import GitHubIcon from '@mui/icons-material/GitHub';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import BugReportIcon from '@mui/icons-material/BugReport';
import EmailIcon from '@mui/icons-material/Email';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TelegramIcon from '@mui/icons-material/Telegram';
import SecurityIcon from '@mui/icons-material/Security';
import TuneIcon from '@mui/icons-material/Tune';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { Device, ThemeMode } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { detectBrowser } from '../utils/platform';
import ThemeSelector from '../components/ThemeSelector';
import LanguageSelector from '../components/LanguageSelector';
import DeviceDialog from '../components/DeviceDialog';
import EncryptionDialog from '../components/EncryptionDialog';
import SoundDialog from '../components/SoundDialog';
import AvatarSetting from '../components/AvatarSetting';
import { openGitHub, openFeedback, openTelegramChannel, openBarkWebsite, openBarkApp, openStoreRating } from '../utils/extension';
import { saveDevices } from '../utils/storage';

interface SettingsProps {
    devices: Device[];
    defaultDeviceId: string;
    onAddDevice: (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => Promise<Device>;
    onEditDevice: (oldDeviceId: string, alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => Promise<Device>;
    onRemoveDevice: (deviceId: string) => Promise<void>;
    onSetDefaultDevice: (deviceId: string) => Promise<void>;
    themeMode: ThemeMode;
    onThemeChange: (mode: ThemeMode) => void;
    onSettingsChange?: () => void;
}

export default function Settings({
    devices,
    defaultDeviceId,
    onAddDevice,
    onEditDevice,
    onRemoveDevice,
    onSetDefaultDevice,
    themeMode,
    onThemeChange,
    onSettingsChange
}: SettingsProps) {
    const { t } = useTranslation();
    const { shortcutKeys, appSettings, updateAppSetting, updateEncryptionConfig } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState<Device | undefined>();
    const [encryptionDialogOpen, setEncryptionDialogOpen] = useState(false);
    const [soundDialogOpen, setSoundDialogOpen] = useState(false);
    const [shortcutGuideAnchor, setShortcutGuideAnchor] = useState<HTMLElement | null>(null);
    const [toast, setToast] = useState<{ open: boolean, message: string }>({ open: false, message: '' });
    const [version, setVersion] = useState<string | null>(null);

    // 检测浏览器类型
    const browserType = detectBrowser();

    // 复制快捷键设置地址
    const handleCopyShortcutUrl = async () => {
        const url = browserType === 'firefox' ? 'about:addons' : `${browserType === 'chrome' ? 'chrome' : 'edge'}://extensions/shortcuts`;
        try {
            await navigator.clipboard.writeText(url);
            // 可以添加一个成功提示，但这里暂时省略
        } catch (error) {
            // 复制失败的处理，这里暂时省略
            console.error('复制失败:', error);
        }
    };

    const handleContextMenuToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableContextMenu', enabled);
        } catch (error) {
            // 更新设置失败: {{message}}
            setError(t('common.error_update', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理右键解析网页内容开关切换
    const handleInspectSendToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableInspectSend', enabled);
        } catch (error) {
            setError(t('common.error_update', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理 Basic Auth 开关切换
    const handleBasicAuthToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableBasicAuth', enabled);
        } catch (error) {
            setError(t('common.error_update', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理加密开关切换
    const handleEncryptionToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableEncryption', enabled);
        } catch (error) {
            // 更新加密设置失败: {{message}}
            setError(t('settings.encryption.errors.update_failed', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理加密配置保存
    const handleEncryptionConfigSave = async (config: any) => {
        try {
            await updateEncryptionConfig(config);
        } catch (error) {
            // 保存加密配置失败: {{message}}
            setError(t('settings.encryption.errors.config_save_failed', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理铃声保存
    const handleSoundSave = async (sound: string) => {
        try {
            await updateAppSetting('sound', sound || undefined);
        } catch (error) {
            // 保存铃声设置失败: {{message}}
            setError(t('common.error_update', { message: error instanceof Error ? error.message : '未知错误' }));
        }
    };

    // 处理 API v2 开关切换
    const handleApiV2Toggle = async (enabled: boolean) => {
        try {
            setLoading(true);
            await updateAppSetting('enableApiV2', enabled);

            // 如果开启API v2，更新现有设备数据
            if (enabled && devices.length > 0) {
                try {
                    // 解析 apiURL 为 server 和 deviceKey
                    const updatedDevices = devices.map(device => {
                        // 如果设备已经有 server 和 deviceKey 不需要更新
                        if (device.server && device.deviceKey) {
                            return device;
                        }

                        try {
                            const url = new URL(device.apiURL);
                            const server = `${url.protocol}//${url.host}`;

                            // 移除开头和结尾的斜杠，获取 deviceKey
                            const pathParts = url.pathname.split('/').filter(part => part);
                            let deviceKey: string | undefined;
                            if (pathParts.length > 0) {
                                deviceKey = pathParts[pathParts.length - 1];
                            }

                            if (server && deviceKey) {
                                return {
                                    ...device,
                                    server,
                                    deviceKey
                                };
                            }
                        } catch (error) {
                            console.error('解析API URL失败:', error, device.apiURL);
                        }

                        return device;
                    });

                    await saveDevices(updatedDevices); // 保存更新后的设备列表

                    // 显示Toast提示
                    setToast({
                        open: true,
                        message: t('settings.api_v2.update_success')
                    });
                } catch (error) {
                    console.error('更新设备数据失败:', error);
                    setToast({
                        open: true,
                        message: t('settings.api_v2.update_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') })
                    });
                }
            }
        } catch (error) {
            setError(t('common.error_update', { message: error instanceof Error ? error.message : '未知错误' }));
        } finally {
            setLoading(false); // 顶部进度条
        }
    };

    const handleAddDevice = async (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => {
        setLoading(true);
        setError('');
        try {
            await onAddDevice(alias, apiURL, authorization);
            onSettingsChange?.();
            setDeviceDialogOpen(false);
            setError('');
        } catch (error) {
            // setError(`添加设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setError(t('common.add_device_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleEditDevice = async (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => {
        if (!editingDevice) return;

        setLoading(true);
        setError('');
        try {
            await onEditDevice(editingDevice.id, alias, apiURL, authorization);
            setEditingDevice(undefined);
            onSettingsChange?.();
            setDeviceDialogOpen(false);
            setError('');
        } catch (error) {
            // setError(`编辑设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setError(t('common.edit_device_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }));
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (deviceId: string) => {
        try {
            await onRemoveDevice(deviceId);
            onSettingsChange?.();
        } catch (error) {
            // setError(`删除设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setError(t('common.delete_device_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }));
        }
    };

    const handleSetDefault = async (deviceId: string) => {
        try {
            await onSetDefaultDevice(deviceId);
            onSettingsChange?.();
        } catch (error) {
            // setError(`设置默认设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setError(t('common.set_default_device_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }));
        }
    };

    useEffect(() => {
        try {
            const v = (window as any)?.chrome?.runtime?.getManifest?.()?.version ?? null;
            setVersion(v);
        } catch {
            setVersion(null);
        }
    }, []);

    return (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box
                sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    minHeight: 'min-content' // 确保内容可以撑开
                }}
            >
                {/* 顶部加载中进度条 绝对定位 */}
                {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }} />}
                {/* 设备管理卡片 */}
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <DevicesIcon />
                                {/* 设备管理 */}
                                {t('device.title')}
                            </Typography>
                            <Button
                                variant="text"
                                startIcon={<AddIcon />}
                                onClick={() => {
                                    setEditingDevice(undefined);
                                    setDeviceDialogOpen(true);
                                }}
                                sx={{
                                    px: 1.2,
                                }}
                            >
                                {/* 添加设备 */}
                                {t('device.add')}
                            </Button>
                        </Box>

                        {error && (
                            <Alert severity="error" onClose={() => setError('')}>
                                {error}
                            </Alert>
                        )}

                        {/* 设备列表 */}
                        {devices.length > 0 ? (
                            <List>
                                {devices.map((device) => (
                                    <ListItem key={device.id} divider sx={{ padding: 0.5 }}>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <FormControlLabel
                                                        value={device.id}
                                                        control={
                                                            <Radio
                                                                checked={defaultDeviceId === device.id}
                                                                onChange={() => handleSetDefault(device.id)}
                                                                size="small"
                                                                sx={{
                                                                    padding: 0,
                                                                }}
                                                            />
                                                        }
                                                        label=""
                                                        sx={{ m: 0 }}
                                                    />
                                                    <Typography variant="body1">{device.alias}</Typography>
                                                </Box>
                                            }
                                            secondary={
                                                <Typography color="text.secondary" variant="caption" sx={{
                                                    display: 'inline-block',
                                                    maxWidth: '180px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>{device.apiURL}</Typography>}
                                        />
                                        <Stack direction="row" gap={1}>
                                            <IconButton
                                                edge="end"
                                                aria-label="编辑"
                                                onClick={() => {
                                                    setEditingDevice(device);
                                                    setDeviceDialogOpen(true);
                                                }}
                                                sx={{ mr: 1 }}
                                            >
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton
                                                edge="end"
                                                aria-label="删除"
                                                onClick={() => handleRemove(device.id)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Stack>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Alert severity="info">
                                {/* 暂无设备，请点击"添加设备"按钮添加一个设备。 */}
                                {t('device.no_devices')}
                            </Alert>
                        )}
                    </Stack>
                </Paper>

                {/* 铃声设置卡片 */}
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <VolumeUpIcon />
                            {/* 铃声设置 */}
                            {t('settings.sound.title')}
                        </Typography>
                        <Stack direction="column" gap={2} >
                            <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                disabled={devices.length === 0}
                                onClick={() => setSoundDialogOpen(true)}
                                startIcon={<VolumeUpIcon />}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                {/* 选择铃声 */}
                                {t('settings.sound.select')}
                            </Button>
                            <Typography variant="body2" color="text.secondary">
                                {/* 当前铃声: {{sound}} */}
                                {t('settings.sound.current', { sound: appSettings?.sound || t('settings.sound.default') })}
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>

                {/* 加密设置卡片 */}
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SecurityIcon fontSize="small" />
                            {/* 加密设置 */}
                            {t('settings.encryption.title')}
                        </Typography>
                        <Stack direction="column" gap={2} >
                            <FormControlLabel
                                control={
                                    <Switch
                                        disabled={devices.length === 0}
                                        checked={appSettings?.enableEncryption || false}
                                        onChange={(e) => handleEncryptionToggle(e.target.checked)}
                                    />
                                }
                                label={t('settings.encryption.enable')}
                                sx={{ userSelect: 'none' }}
                            />
                            {/* 根据算法的对应长度检测 key 是否有效 */}
                            {appSettings?.enableEncryption && (() => {
                                const algorithm = appSettings?.encryptionConfig?.algorithm;
                                const key = appSettings?.encryptionConfig?.key || '';
                                let isValid = false;

                                switch (algorithm) {
                                    case 'AES256':
                                        isValid = /^[A-Za-z0-9]{32}$/.test(key);
                                        break;
                                    case 'AES192':
                                        isValid = /^[A-Za-z0-9]{24}$/.test(key);
                                        break;
                                    case 'AES128':
                                        isValid = /^[A-Za-z0-9]{16}$/.test(key);
                                        break;
                                }

                                return (
                                    <Alert severity={isValid ? "success" : "error"} sx={{ mt: 1 }}>
                                        <Typography variant="body2">
                                            {isValid ?
                                                /* 密钥有效 */
                                                t('settings.encryption.key_valid') :
                                                /* 密钥无效 */
                                                t('settings.encryption.key_invalid')
                                            }
                                        </Typography>
                                    </Alert>
                                );
                            })()}

                            {appSettings?.enableEncryption && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    onClick={() => setEncryptionDialogOpen(true)}
                                    startIcon={<TuneIcon />}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    {/* 加密选项 */}
                                    {t('settings.encryption.options')}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Paper>

                {/* 其他设置卡片 */}
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SettingsIcon />
                            {/* 其他设置 */}
                            {t('settings.title')}
                        </Typography>

                        <Box>
                            <Typography variant="subtitle1" gutterBottom>
                                {/* 主题设置 */}
                                {t('settings.theme.title')}
                            </Typography>
                            <ThemeSelector themeMode={themeMode} onThemeChange={onThemeChange} />
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" gutterBottom>
                                {/* 语言设置 */}
                                {t('settings.language.title')}
                            </Typography>
                            <LanguageSelector />
                        </Box>

                        <Divider />
                        <Box>
                            <Typography variant="subtitle1" gutterBottom>
                                {/* 右键菜单 */}
                                {t('settings.context_menu.title')}
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        disabled={devices.length === 0}
                                        checked={appSettings?.enableContextMenu || false}
                                        onChange={(e) => handleContextMenuToggle(e.target.checked)}
                                        color='primary'
                                    />
                                }
                                label={t('settings.context_menu.enable')}
                                sx={{ userSelect: 'none' }}
                            />
                            {appSettings?.enableContextMenu && (
                                <FormControlLabel
                                    control={
                                        <Switch
                                            disabled={devices.length === 0}
                                            checked={appSettings?.enableInspectSend || false}
                                            onChange={(e) => handleInspectSendToggle(e.target.checked)}
                                            color='warning'
                                        />
                                    }
                                    label={t('settings.context_menu.enable_inspect_send')}
                                    sx={{ userSelect: 'none' }}
                                />
                            )}
                        </Box>

                        <Box>
                            <Typography variant="subtitle1" gutterBottom>
                                {/* 功能开关 */}
                                {t('settings.features.title')}
                            </Typography>

                            <Stack direction="column" alignItems="flex-start" gap={1}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={appSettings?.enableBasicAuth || false}
                                            onChange={(e) => handleBasicAuthToggle(e.target.checked)}
                                        />
                                    }
                                    // Basic Auth
                                    label={t('device.basic_auth.title')}
                                    sx={{ userSelect: 'none' }}
                                />
                                {/* 自定义头像 */}
                                <AvatarSetting />
                                {/* API v2 开关 */}
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={appSettings?.enableApiV2 || false}
                                            onChange={(e) => handleApiV2Toggle(e.target.checked)}
                                        />
                                    }
                                    label={t('settings.api_v2.title')}
                                    sx={{ userSelect: 'none' }}
                                />
                                {/* 启用完整的参数配置 */}
                                {/* <FormControlLabel
                                    control={
                                        <Switch
                                        />
                                    }
                                    label="启用完整的参数配置"
                                    sx={{ userSelect: 'none' }}
                                /> */}
                            </Stack>
                        </Box>

                        <Divider />

                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle1" gutterBottom>
                                    {/* 快捷键 */}
                                    {t('settings.shortcuts.title')}
                                </Typography>
                                <IconButton
                                    onClick={(event) => setShortcutGuideAnchor(event.currentTarget)}
                                    size="small"
                                    sx={{
                                        mb: 1
                                    }}
                                    color='inherit'
                                >
                                    <KeyboardIcon />
                                </IconButton>
                            </Stack>
                            <Popover
                                open={Boolean(shortcutGuideAnchor)}
                                anchorEl={shortcutGuideAnchor}
                                onClose={() => setShortcutGuideAnchor(null)}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'left',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left',
                                }}
                            >
                                <Box sx={{ p: 2, maxWidth: 320 }}>
                                    <Typography variant="body2" gutterBottom>
                                        {t('settings.shortcuts.guide')}
                                    </Typography>

                                    {browserType === 'firefox' && (
                                        <Typography variant="body2" gutterBottom>
                                            {t('settings.shortcuts.guide_firefox')}
                                        </Typography>
                                    )}

                                    <Box sx={{
                                        mt: 2,
                                        p: 1,
                                        backgroundColor: 'text.secondary',
                                        color: 'background.paper',
                                        borderRadius: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1
                                    }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem',
                                                wordBreak: 'break-all'
                                            }}
                                        >
                                            {browserType === 'firefox' ? 'about:addons' : `${browserType === 'chrome' ? 'chrome' : 'edge'}://extensions/shortcuts`}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={handleCopyShortcutUrl}
                                            sx={{ flexShrink: 0 }}
                                            color='inherit'
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            </Popover>
                            <Alert
                                icon={<InfoIcon />}
                                severity="info"
                                sx={{
                                    '& .MuiAlert-message': {
                                        width: '100%'
                                    }
                                }}
                            >
                                <Typography variant="body2" component="div" gutterBottom>
                                    {/* 打开推送窗口: {{key}} */}
                                    {t('settings.shortcuts.open_window', { key: shortcutKeys.openExtension })}
                                </Typography>
                            </Alert>
                        </Box>
                    </Stack>
                </Paper>

                {/* 了解 Bark 卡片 */}
                <Paper elevation={2} sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AutoStoriesIcon />
                            {/* 了解 Bark */}
                            {t('about.bark_website.title')}
                        </Typography>

                        <Stack direction="column" alignItems="flex-start" gap={1}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <Tooltip title={t('about.bark_website.description')}>
                                    {/* 查看文档 */}
                                    <Button
                                        variant="outlined"
                                        size='small'
                                        color='success'
                                        onClick={openBarkWebsite}
                                        sx={{
                                            px: 1.2,
                                        }}
                                    >
                                        {t('about.bark_website.documentation')}
                                    </Button>
                                </Tooltip>
                                <Tooltip title={t('about.bark_app.description')}>
                                    {/* 下载 Bark App */}
                                    <Button
                                        variant="outlined"
                                        color='secondary'
                                        size='small'
                                        onClick={openBarkApp}
                                        sx={{
                                            px: 1.2,
                                        }}
                                    >
                                        {t('about.bark_app.title')}
                                    </Button>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Box>
                    {/* 关于卡片 */}
                    <Paper
                        elevation={2}
                        sx={{
                            p: 3,
                            mb: 6, // 底部外边距
                            zIndex: 2,
                            position: 'relative'
                        }}
                    >
                        <Stack spacing={3}>
                            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <InfoIcon />
                                {/* 关于 */}
                                {t('about.title')}
                            </Typography>

                            <List>
                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <GitHubIcon fontSize="small" />
                                                <Typography variant="body1">
                                                    {/* GitHub */}
                                                    {t('about.github.title')}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={t('about.github.description')}
                                        onClick={openGitHub}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <Tooltip title={t('about.github.description2')}>
                                        <IconButton edge="end" onClick={openGitHub}>
                                            <FavoriteBorderIcon />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>

                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <BugReportIcon fontSize="small" />
                                                <Typography variant="body1">
                                                    {/* 问题反馈 */}
                                                    {t('about.feedback.title')}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={t('about.feedback.description')}
                                        onClick={openGitHub}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <Tooltip title={t('about.feedback.description2')}>
                                        <IconButton edge="end" onClick={openFeedback}>
                                            <ChatBubbleOutlineIcon />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>

                                <Divider sx={{ my: 1 }} />

                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <StarBorderIcon fontSize="small" />
                                                <Typography variant="body1">
                                                    {/* 商店评分 */}
                                                    {t('about.store_rating.title')}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={t('about.store_rating.description')}
                                        onClick={openStoreRating}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <IconButton edge="end" onClick={openStoreRating}>
                                        <OpenInNewIcon />
                                    </IconButton>
                                </ListItem>

                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <TelegramIcon fontSize="small" />
                                                <Typography variant="body1">
                                                    {/* Telegram 频道 */}
                                                    {t('about.telegram.title')}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={t('about.telegram.description')}
                                        onClick={openTelegramChannel}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                    <IconButton edge="end" onClick={openTelegramChannel}>
                                        <OpenInNewIcon />
                                    </IconButton>
                                </ListItem>

                                <ListItem sx={{ px: 0 }}>
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <EmailIcon fontSize="small" />
                                                <Typography variant="body1">
                                                    {/* 联系方式 */}
                                                    {t('about.contact.title')}
                                                </Typography>
                                            </Stack>
                                        }
                                        secondary={
                                            <Link
                                                href={`mailto:${t('about.contact.email')}`}
                                                underline="hover"
                                                color="inherit"
                                            >
                                                {t('about.contact.email')}
                                            </Link>
                                        }
                                    />
                                </ListItem>
                            </List>
                        </Stack>
                    </Paper>
                    {/* 版本 */}
                    {version && (
                        <Stack sx={{
                            textAlign: 'center',
                            position: 'sticky',
                            width: '100%',
                            bottom: '8px',
                            zIndex: 1,
                            opacity: 0.5
                        }}>
                            <Typography variant="caption" color="text.secondary">
                                {`${t('about.version')}: v${version}`}
                            </Typography>
                        </Stack>
                    )}
                </Box>

            </Box>

            <DeviceDialog
                open={deviceDialogOpen}
                onClose={() => {
                    setDeviceDialogOpen(false);
                    setEditingDevice(undefined);
                }}
                onSubmit={editingDevice ? handleEditDevice : handleAddDevice}
                editDevice={editingDevice}
                title={editingDevice ? t('device.edit') : t('device.add')}
            />

            <EncryptionDialog
                open={encryptionDialogOpen}
                config={appSettings?.encryptionConfig || {
                    algorithm: 'AES256',
                    mode: 'CBC',
                    padding: 'pkcs7',
                    key: ''
                }}
                onClose={() => setEncryptionDialogOpen(false)}
                onSave={handleEncryptionConfigSave}
            />

            <SoundDialog
                open={soundDialogOpen}
                onClose={() => setSoundDialogOpen(false)}
                onSave={handleSoundSave}
                currentSound={appSettings?.sound || ''}
            />

            {/* Toast提示 */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast({ ...toast, open: false })}
                message={toast.message}
            />
        </Box>
    );
} 