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
    ListItemSecondaryAction,
    Radio,
    FormControlLabel,
    Switch,
    Link
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import GitHubIcon from '@mui/icons-material/GitHub';
import BugReportIcon from '@mui/icons-material/BugReport';
import EmailIcon from '@mui/icons-material/Email';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TelegramIcon from '@mui/icons-material/Telegram';
import { useTranslation } from 'react-i18next';
import { Device, AppSettings, ThemeMode } from '../types';
import { getAppSettings, updateAppSetting } from '../utils/settings';
import { useAppContext } from '../contexts/AppContext';
import ThemeSelector from '../components/ThemeSelector';
import DeviceDialog from '../components/DeviceDialog';
import { openExtensionShortcuts, openGitHub, openFeedback, openTelegramChannel } from '../utils/extension';

interface SettingsProps {
    devices: Device[];
    defaultDeviceId: string;
    onAddDevice: (alias: string, apiURL: string) => Promise<Device>;
    onEditDevice: (oldDeviceId: string, alias: string, apiURL: string) => Promise<Device>;
    onRemoveDevice: (deviceId: string) => Promise<void>;
    onSetDefaultDevice: (deviceId: string) => Promise<void>;
    themeMode: ThemeMode;
    onThemeChange: (mode: ThemeMode) => void;
}

export default function Settings({
    devices,
    defaultDeviceId,
    onAddDevice,
    onEditDevice,
    onRemoveDevice,
    onSetDefaultDevice,
    themeMode,
    onThemeChange
}: SettingsProps) {
    const { t } = useTranslation();
    const { shortcutKeys } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [appSettings, setAppSettings] = useState<AppSettings>({
        enableContextMenu: true,
        themeMode: 'system'
    });
    const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState<Device | undefined>();

    // 加载应用设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getAppSettings();
                setAppSettings(settings);
            } catch (error) {
                console.error('加载设置失败:', error);
            }
        };
        loadSettings();
    }, []);

    const handleContextMenuToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableContextMenu', enabled);
            setAppSettings(prev => ({ ...prev, enableContextMenu: enabled }));
        } catch (error) {
            setError(`更新设置失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const handleAddDevice = async (alias: string, apiURL: string) => {
        setLoading(true);
        setError('');
        try {
            await onAddDevice(alias, apiURL);
        } catch (error) {
            setError(`添加设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleEditDevice = async (alias: string, apiURL: string) => {
        if (!editingDevice) return;

        setLoading(true);
        setError('');
        try {
            await onEditDevice(editingDevice.id, alias, apiURL);
            setEditingDevice(undefined);
        } catch (error) {
            setError(`编辑设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (deviceId: string) => {
        try {
            await onRemoveDevice(deviceId);
        } catch (error) {
            setError(`删除设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const handleSetDefault = async (deviceId: string) => {
        try {
            await onSetDefaultDevice(deviceId);
        } catch (error) {
            setError(`设置默认设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

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
                                {/* 右键菜单 */}
                                {t('settings.context_menu.title')}
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={appSettings.enableContextMenu}
                                        onChange={(e) => handleContextMenuToggle(e.target.checked)}
                                    />
                                }
                                label={t('settings.context_menu.enable')}
                                sx={{ userSelect: 'none' }}
                            />
                        </Box>

                        <Box>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle1" gutterBottom>
                                    {/* 快捷键 */}
                                    {t('settings.shortcuts.title')}
                                </Typography>
                                <Button
                                    startIcon={<KeyboardIcon />}
                                    onClick={openExtensionShortcuts}
                                    size="small"
                                >
                                    {/* 修改快捷键 */}
                                    {t('settings.shortcuts.edit')}
                                </Button>
                            </Stack>
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

                {/* 关于卡片 */}
                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        mb: 8 // 底部外边距
                    }}
                >
                    <Stack spacing={3}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InfoIcon />
                            {/* 关于 */}
                            {t('about.title')}
                        </Typography>

                        <List>
                            <ListItem sx={{ display: 'none' }}>
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
                                />
                                <IconButton edge="end" onClick={openGitHub}>
                                    <OpenInNewIcon />
                                </IconButton>
                            </ListItem>

                            <ListItem sx={{ display: 'none' }}>
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
                                />
                                <IconButton edge="end" onClick={openFeedback}>
                                    <OpenInNewIcon />
                                </IconButton>
                            </ListItem>

                            <ListItem>
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
                                />
                                <IconButton edge="end" onClick={openTelegramChannel}>
                                    <OpenInNewIcon />
                                </IconButton>
                            </ListItem>


                            <ListItem>
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
        </Box>
    );
} 