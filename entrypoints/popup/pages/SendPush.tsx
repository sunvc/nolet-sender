import React, { useState, useEffect, useRef, forwardRef } from 'react';
import {
    Box,
    TextField,
    Button,
    Paper,
    Typography,
    Alert,
    CircularProgress,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import SendIcon from '@mui/icons-material/Send';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { useTranslation } from 'react-i18next';
import { Device } from '../types';
import { sendPushMessage } from '../utils/api';
import { readClipboard } from '../utils/clipboard';
import { useAppContext } from '../contexts/AppContext';
import DeviceSelect from '../components/DeviceSelect';
import DeviceDialog from '../components/DeviceDialog';
import ShortcutTips from '../components/ShortcutTips';

const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

interface SendPushProps {
    devices: Device[];
    defaultDevice?: Device | null;
    onAddDevice: (alias: string, apiURL: string) => Promise<Device>;
}

export default function SendPush({ devices, defaultDevice, onAddDevice }: SendPushProps) {
    const { t } = useTranslation();
    const { shortcutKeys, isAppleDevice } = useAppContext();
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [clipboardLoading, setClipboardLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
    const [shortcutClipboardText, setShortcutClipboardText] = useState('');
    const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
    const sendButtonRef = useRef<HTMLButtonElement>(null);

    // 设置默认选中设备
    useEffect(() => {
        if (defaultDevice && !selectedDevice) {
            setSelectedDevice(defaultDevice);
        }
    }, [defaultDevice, selectedDevice]);

    // 监听来自background的快捷键消息
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.action === 'shortcut-triggered') {
                handleShortcutTriggered();
            }
        };

        // 添加消息监听器
        try {
            // 优先使用browser API (Firefox/新版Chrome)
            if (typeof browser !== 'undefined' && browser.runtime) {
                browser.runtime.onMessage.addListener(handleMessage);
                return () => {
                    try {
                        browser.runtime.onMessage.removeListener(handleMessage);
                    } catch (error) {
                        console.debug('移除消息监听器失败:', error);
                    }
                };
            }
            // 兼容旧版Chrome
            else if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
                (window as any).chrome.runtime.onMessage.addListener(handleMessage);
                return () => {
                    try {
                        (window as any).chrome.runtime.onMessage.removeListener(handleMessage);
                    } catch (error) {
                        console.debug('移除消息监听器失败:', error);
                    }
                };
            }
        } catch (error) {
            console.debug('添加消息监听器失败:', error);
        }
    }, [selectedDevice]);

    // 处理快捷键触发
    const handleShortcutTriggered = async () => {
        if (!selectedDevice) {
            /* 请先配置默认设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        }

        try {
            const clipboardText = await readClipboard();
            setShortcutClipboardText(clipboardText || '');
            setShortcutDialogOpen(true);

            setTimeout(() => {
                if (sendButtonRef.current) {
                    sendButtonRef.current.focus();
                }
            }, 100);
        } catch (error) {
            /* 发送剪切板失败: {{message}} */
            setResult({
                type: 'error',
                message: t('push.errors.clipboard_failed', { message: error instanceof Error ? error.message : '未知错误' })
            });
        }
    };

    // 处理快捷键Dialog中的发送
    const handleShortcutSend = async () => {
        if (!selectedDevice || !shortcutClipboardText.trim()) {
            return;
        }

        setLoading(true);

        try {
            const response = await sendPushMessage(selectedDevice.apiURL, shortcutClipboardText.trim(), selectedDevice.alias);

            if (response.code === 200) {
                setShortcutDialogOpen(false);
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage(shortcutClipboardText);
            } else {
                /* 发送失败: {{message}} */
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: response.message }) });
            }
        } catch (error) {
            /* 发送失败: {{message}} */
            setResult({
                type: 'error',
                message: t('push.errors.send_failed', { message: error instanceof Error ? error.message : '未知错误' })
            });
        } finally {
            setLoading(false);
        }
    };

    // 处理快捷键Dialog中的按键事件
    const handleShortcutDialogKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !loading) {
            event.preventDefault();
            handleShortcutSend();
        } else if (event.key === 'Escape') {
            handleShortcutCancel();
        }
    };

    // 处理快捷键对话框取消操作
    const handleShortcutCancel = () => {
        setShortcutDialogOpen(false);
        // 如果是窗口模式，关闭整个窗口
        if (isWindowMode) {
            window.close();
        }
    };

    const handleSend = async () => {
        if (!selectedDevice) {
            /* 请选择一个设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        }

        if (!message.trim()) {
            /* 请输入推送内容 */
            setResult({ type: 'error', message: t('push.errors.no_content') });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await sendPushMessage(selectedDevice.apiURL, message.trim(), selectedDevice.alias);

            if (response.code === 200) {
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage('');
            } else {
                /* 发送失败: {{message}} */
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: response.message }) });
            }
        } catch (error) {
            /* 发送失败: {{message}} */
            setResult({
                type: 'error',
                message: t('push.errors.send_failed', { message: error instanceof Error ? error.message : '未知错误' })
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendClipboard = async () => {
        if (!selectedDevice) {
            /* 请选择一个设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        }

        setClipboardLoading(true);
        setResult(null);

        try {
            const clipboardText = await readClipboard();

            if (!clipboardText || !clipboardText.trim()) {
                /* 剪切板为空或无有效内容 */
                setResult({ type: 'error', message: t('push.clipboard_empty') });
                return;
            }

            const response = await sendPushMessage(selectedDevice.apiURL, clipboardText.trim(), selectedDevice.alias);

            if (response.code === 200) {
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage(clipboardText.trim());
            } else {
                /* 发送失败: {{message}} */
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: response.message }) });
            }
        } catch (error) {
            /* 发送剪切板失败: {{message}} */
            setResult({
                type: 'error',
                message: t('push.errors.clipboard_failed', { message: error instanceof Error ? error.message : '未知错误' })
            });
        } finally {
            setClipboardLoading(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        const isCorrectModifier = isAppleDevice
            ? (event.metaKey && !event.ctrlKey)
            : (event.ctrlKey && !event.metaKey);

        if (event.key === 'Enter' && isCorrectModifier) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleAddDevice = async (alias: string, apiURL: string) => {
        try {
            const newDevice = await onAddDevice(alias, apiURL);
            setSelectedDevice(newDevice);
            setDeviceDialogOpen(false);
        } catch (error) {
            setResult({
                type: 'error',
                message: t('push.errors.add_device', { message: error instanceof Error ? error.message : '未知错误' })
            });
        }
    };

    // 检测是否是窗口模式
    const isWindowMode = new URLSearchParams(window.location.search).get('mode') === 'window';

    // 检测是否需要自动打开添加设备对话框
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const autoAddDevice = urlParams.get('autoAddDevice') === 'true';

        if (autoAddDevice && devices.length === 0) {
            // 读取剪切板内容到输入框
            const loadClipboardContent = async () => {
                try {
                    const clipboardText = await readClipboard();
                    if (clipboardText && clipboardText.trim()) {
                        setMessage(clipboardText.trim());
                    }
                } catch (error) {
                    console.debug('读取剪切板失败:', error);
                }
            };

            // 延迟一下确保组件完全加载，然后读取剪切板并打开对话框
            setTimeout(() => {
                loadClipboardContent();
                setDeviceDialogOpen(true);
                // 移除网址参数
                window.history.replaceState({}, '', window.location.pathname);
            }, 600);
        }
    }, [devices.length]);

    return (
        <>
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Paper elevation={2} sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {/* 发送推送消息 */}
                        {t('push.title')}
                    </Typography>

                    <DeviceSelect
                        devices={devices}
                        selectedDevice={selectedDevice}
                        onDeviceChange={setSelectedDevice}
                        onAddClick={() => setDeviceDialogOpen(true)}
                    />

                    <TextField
                        /* 推送内容 */
                        label={t('push.message')}
                        /* 输入要推送的消息内容 */
                        placeholder={t('push.message_placeholder')}
                        multiline
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        variant="outlined"
                        size="small"
                        fullWidth
                    />

                    {result && (
                        <Alert severity={result.type} onClose={() => setResult(null)}>
                            {result.message}
                        </Alert>
                    )}

                    <Stack spacing={2} sx={{ mt: 'auto' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                            onClick={handleSend}
                            disabled={loading || clipboardLoading || !selectedDevice || !message.trim()}
                            fullWidth
                        >
                            {/* 发送中... / 发送推送 */}
                            {loading ? t('push.sending') : t('push.send')}
                        </Button>

                        <Button
                            variant="outlined"
                            size="large"
                            startIcon={clipboardLoading ? <CircularProgress size={20} /> : <ContentPasteIcon />}
                            onClick={handleSendClipboard}
                            disabled={loading || clipboardLoading || !selectedDevice}
                            fullWidth
                        >
                            {/* 读取剪切板中... / 发送剪切板内容 */}
                            {clipboardLoading ? t('push.reading_clipboard') : t('push.send_clipboard')}
                        </Button>

                        <ShortcutTips
                            tips={[
                                { key: shortcutKeys.send, description: t('push.send') },
                                { key: shortcutKeys.openExtension, description: t('push.open_extension') }
                            ]}
                        />
                    </Stack>
                </Paper>
            </Box>

            {/* 快捷键触发的Dialog */}
            <Dialog
                open={shortcutDialogOpen}
                onClose={() => setShortcutDialogOpen(false)}
                onKeyDown={handleShortcutDialogKeyDown}
                maxWidth="sm"
                fullWidth
                slots={{
                    transition: Transition,
                }}
                keepMounted
            >
                <DialogTitle>
                    {/* 快速发送剪切板内容 */}
                    {t('push.send_clipboard')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                {/* 目标设备 */}
                                {t('push.target_device')}:
                            </Typography>
                            <DeviceSelect
                                showLabel={false}
                                devices={devices}
                                selectedDevice={selectedDevice}
                                onDeviceChange={setSelectedDevice}
                                onAddClick={() => {
                                    setShortcutDialogOpen(false);
                                    setDeviceDialogOpen(true);
                                }}
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                {/* 剪切板内容 */}
                                {t('push.message')}:
                            </Typography>
                            <Paper
                                variant="outlined"
                                sx={{
                                    p: 2,
                                    bgcolor: 'background.paper',
                                    maxHeight: 200,
                                    overflow: 'auto'
                                }}
                            >
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {/* 剪切板为空 */}
                                    {shortcutClipboardText || t('push.clipboard_empty')}
                                </Typography>
                            </Paper>
                        </Box>

                        <Alert severity="info" icon={<KeyboardIcon />}>
                            <Typography variant="body2">
                                {/* 按 Enter 发送，按 Esc 取消 */}
                                {t('push.shortcut_enter_prefix')} <strong>Enter</strong> {t('push.shortcut_esc_prefix')} <strong>Esc</strong> {t('push.shortcut_esc_suffix')}
                            </Typography>
                        </Alert>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleShortcutCancel}>
                        {/* 取消 */}
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleShortcutSend}
                        disabled={loading || !shortcutClipboardText.trim()}
                        ref={sendButtonRef}
                    >
                        {/* 发送中... / 发送 */}
                        {loading ? t('push.sending') : t('push.send')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 添加设备Dialog */}
            <DeviceDialog
                open={deviceDialogOpen}
                onClose={() => setDeviceDialogOpen(false)}
                onSubmit={handleAddDevice}
            />
        </>
    );
} 