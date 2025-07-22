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
    Divider
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
import SecurityIcon from '@mui/icons-material/Security';
import TuneIcon from '@mui/icons-material/Tune';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useTranslation } from 'react-i18next';
import { Device, ThemeMode } from '../types';
import { useAppContext } from '../contexts/AppContext';
import ThemeSelector from '../components/ThemeSelector';
import DeviceDialog from '../components/DeviceDialog';
import EncryptionDialog from '../components/EncryptionDialog';
import SoundDialog from '../components/SoundDialog';
import { openExtensionShortcuts, openGitHub, openFeedback, openTelegramChannel, openBarkWebsite, openBarkApp } from '../utils/extension';

interface SettingsProps {
    devices: Device[];
    defaultDeviceId: string;
    onAddDevice: (alias: string, apiURL: string) => Promise<Device>;
    onEditDevice: (oldDeviceId: string, alias: string, apiURL: string) => Promise<Device>;
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

    const handleContextMenuToggle = async (enabled: boolean) => {
        try {
            await updateAppSetting('enableContextMenu', enabled);
        } catch (error) {
            // 更新设置失败: {{message}}
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

    const handleAddDevice = async (alias: string, apiURL: string) => {
        setLoading(true);
        setError('');
        try {
            await onAddDevice(alias, apiURL);
            onSettingsChange?.();
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
            onSettingsChange?.();
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
            onSettingsChange?.();
        } catch (error) {
            setError(`删除设备失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const handleSetDefault = async (deviceId: string) => {
        try {
            await onSetDefaultDevice(deviceId);
            onSettingsChange?.();
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
                                {/* 右键菜单 */}
                                {t('settings.context_menu.title')}
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        disabled={devices.length === 0}
                                        checked={appSettings?.enableContextMenu || false}
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
                                    sx={{
                                        px: 1.2,
                                        mb: 1
                                    }}
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
                            <ListItem>
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
                                <Tooltip title={t('about.github.description2')}>
                                    <IconButton edge="end" onClick={openGitHub}>
                                        <OpenInNewIcon />
                                    </IconButton>
                                </Tooltip>
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
        </Box>
    );
} 