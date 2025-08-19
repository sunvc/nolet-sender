import React, { useState, useEffect, useRef, forwardRef, useLayoutEffect } from 'react';
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
    Slide,
    IconButton,
    Tooltip
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import SendIcon from '@mui/icons-material/Send';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import UndoIcon from '@mui/icons-material/Undo';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { Device } from '../types';
import { sendPushMessage } from '../utils/api';
import { generateUUID } from '../../shared/push-service';
import { readClipboard } from '../utils/clipboard';
import { getHistoryRecordByUuid, updateHistoryRecordStatus } from '../utils/database';
import { useAppContext } from '../contexts/AppContext';
import DeviceSelect from '../components/DeviceSelect';
import DeviceSelectV2 from '../components/DeviceSelectV2';
import DeviceDialog from '../components/DeviceDialog';
import ShortcutTips from '../components/ShortcutTips';
import UrlDialog from '../components/UrlDialog';
import UrlDialogV2 from '../components/UrlDialogV2';
import AdvancedParamsEditor from '../components/AdvancedParamsEditor';
import { getAppSettings } from '../utils/settings';

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
    defaultDevice: Device | null;
    onAddDevice: (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => Promise<Device>;
}

export default function SendPush({ devices, defaultDevice, onAddDevice }: SendPushProps) {
    const { t } = useTranslation();
    const { shortcutKeys, isAppleDevice } = useAppContext();
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [selectedDevices, setSelectedDevices] = useState<Device[]>([]);
    const [isApiV2, setIsApiV2] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [clipboardLoading, setClipboardLoading] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [shortcutDialogOpen, setShortcutDialogOpen] = useState(false);
    const [shortcutClipboardText, setShortcutClipboardText] = useState('');
    const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
    const [lastPushUuid, setLastPushUuid] = useState<string | null>(null); // 记录最后一次推送的UUID
    const [recallLoading, setRecallLoading] = useState(false); // 撤回操作加载状态
    const sendButtonRef = useRef<HTMLButtonElement>(null);
    const paperRef = useRef<HTMLDivElement>(null); // 添加Paper的ref
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [urlParams, setUrlParams] = useState<{
        url?: string;
        title?: string;
        selectionText?: string;
    }>({});

    // 自定义参数
    const [advancedParams, setAdvancedParams] = useState<Record<string, any> | undefined>(undefined);

    // 从本地存储恢复消息内容
    useEffect(() => {
        const savedMessage = localStorage.getItem('bark-sender-draft-message');
        if (savedMessage) {
            setMessage(savedMessage);
        }
    }, []);

    // 消息输入变化时实时暂存到ls
    const handleMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newMessage = event.target.value;
        setMessage(newMessage);

        // 暂存消息内容
        if (newMessage.trim()) {
            localStorage.setItem('bark-sender-draft-message', newMessage);
        } else {
            localStorage.removeItem('bark-sender-draft-message');
        }
    };

    // 清除暂存
    const clearDraftMessage = () => {
        localStorage.removeItem('bark-sender-draft-message');
    };

    // 检查API版本并设置默认选中设备
    useEffect(() => {
        const checkApiVersion = async () => {
            const settings = await getAppSettings();
            setIsApiV2(settings.enableApiV2 || false);

            if (defaultDevice) {
                if (settings.enableApiV2) {
                    setSelectedDevices([defaultDevice]);
                } else {
                    setSelectedDevice(defaultDevice);
                }
            }
        };

        checkApiVersion();
    }, [defaultDevice]);

    // 检测是否是窗口模式
    const isWindowMode = new URLSearchParams(window.location.search).get('mode') === 'window';

    // 监听来自background的快捷键消息
    useEffect(() => {
        const handleMessage = (message: any) => {
            // 只有在窗口模式下才响应快捷键触发消息
            if (message.action === 'shortcut-triggered' && isWindowMode) {
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
    }, [selectedDevice, isWindowMode]);

    // 处理快捷键触发
    const handleShortcutTriggered = async () => {
        if (isApiV2 && selectedDevices.length === 0 && !defaultDevice) {
            /* 请先配置默认设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        } else if (!isApiV2 && !selectedDevice && !defaultDevice) {
            /* 请先配置默认设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        }

        try {
            const clipboardText = await readClipboard();
            setShortcutClipboardText(clipboardText || '');

            // 如果是API v2且没有选择设备，但有默认设备，则自动选择默认设备
            if (isApiV2 && selectedDevices.length === 0 && defaultDevice) {
                setSelectedDevices([defaultDevice]);
            } else if (!isApiV2 && !selectedDevice && defaultDevice) {
                setSelectedDevice(defaultDevice);
            }

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
        if ((isApiV2 && selectedDevices.length === 0) || (!isApiV2 && !selectedDevice) || !shortcutClipboardText.trim()) {
            return;
        }

        setLoading(true);

        try {
            const pushUuid = generateUUID();
            setLastPushUuid(pushUuid);

            // 如果 JSON 格式有误, 显示提示但继续发送
            if (advancedParams === undefined) {
                console.warn('自定义参数无效，忽略自定义参数');
            }

            const response = await sendPushMessage(
                isApiV2 ? selectedDevices[0] : selectedDevice!,
                shortcutClipboardText.trim(),
                undefined,
                pushUuid,
                undefined,
                undefined,
                advancedParams,
                isApiV2 ? selectedDevices : undefined
            );

            if (response.code === 200) {
                setShortcutDialogOpen(false);
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage(shortcutClipboardText);
                // 发送成功后清除暂存内容
                clearDraftMessage();
            } else {
                /* 发送失败: {{message}} */
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: response.message }) });
            }
        } catch (error) {
            /* 发送失败: {{message}} */
            const errorMessage = error instanceof Error ? error.message : t('common.error_unknown'); // 未知错误
            const finalMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
            setResult({
                type: 'error',
                message: t('push.errors.send_failed', { message: finalMessage })
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

    // 处理撤回操作
    const handleRecall = async () => {
        if (!lastPushUuid) {
            setResult({ type: 'error', message: t('push.recall.no_record') });
            return;
        }

        setRecallLoading(true);

        try {
            const historyRecord = await getHistoryRecordByUuid(lastPushUuid);

            if (!historyRecord) {
                setResult({ type: 'error', message: t('push.recall.record_not_found') });
                return;
            }

            const recallUrl = `${historyRecord.apiUrl}?id=${encodeURIComponent(lastPushUuid)}&delete=1`;
            console.debug('发送撤回请求到:', recallUrl);

            const headers: Record<string, string> = {};
            if (historyRecord.authorization && historyRecord.authorization.value) {
                headers['Authorization'] = historyRecord.authorization.value;
            }

            const response = await fetch(recallUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                ...(Object.keys(headers).length > 0 && { headers })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.debug('撤回请求结果:', result);

            if (result.code === 200) {
                setResult({ type: 'success', message: t('push.recall.success') });
                // 更新数据库记录状态
                await updateHistoryRecordStatus(lastPushUuid, 'recalled');
                // 再清空UUID，防止重复撤回
                setLastPushUuid(null);
            } else {
                setResult({ type: 'error', message: t('push.recall.failed', { message: result.message || '未知错误' }) });
            }
        } catch (error) {
            // console.error('撤回操作失败:', error);
            console.error(t('push.recall.operation_failed'), error);
            setResult({
                type: 'error',
                message: t('push.recall.failed', { message: error instanceof Error ? error.message : '网络错误' })
            });
        } finally {
            setRecallLoading(false);
        }
    };

    const handleSend = async () => {
        if (isApiV2 && selectedDevices.length === 0) {
            /* 请选择至少一个设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        } else if (!isApiV2 && !selectedDevice) {
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
            // 生成新的 UUID 记录
            const pushUuid = generateUUID();
            setLastPushUuid(pushUuid);

            const response = await sendPushMessage(
                isApiV2 ? selectedDevices[0] : selectedDevice!,
                message.trim(),
                undefined,
                pushUuid,
                undefined,
                undefined,
                advancedParams,
                isApiV2 ? selectedDevices : undefined
            );

            if (response.code === 200) {
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage('');
                clearDraftMessage(); // 清除暂存
            } else {
                /* 发送失败: {{message}} */
                const errorMessage = response.message || t('common.error_unknown');
                const finalMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: finalMessage }) });
            }
        } catch (error) {
            /* 发送失败: {{message}} */
            const errorMessage = error instanceof Error ? error.message : t('common.error_unknown'); // 未知错误
            const finalMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
            setResult({
                type: 'error',
                message: t('push.errors.send_failed', { message: finalMessage })
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendClipboard = async () => {
        if (isApiV2 && selectedDevices.length === 0) {
            /* 请选择至少一个设备 */
            setResult({ type: 'error', message: t('push.errors.no_device') });
            return;
        } else if (!isApiV2 && !selectedDevice) {
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

            const pushUuid = generateUUID();
            setLastPushUuid(pushUuid);

            const response = await sendPushMessage(
                isApiV2 ? selectedDevices[0] : selectedDevice!,
                clipboardText.trim(),
                undefined,
                pushUuid,
                undefined,
                undefined,
                advancedParams,
                isApiV2 ? selectedDevices : undefined
            );

            if (response.code === 200) {
                /* 推送发送成功！ */
                setResult({ type: 'success', message: t('push.success') });
                setMessage(clipboardText.trim());
                localStorage.setItem('bark-sender-draft-message', clipboardText.trim()); // 更新暂存内容为剪切板内容
            } else {
                /* 发送失败: {{message}} */
                const errorMessage = response.message || t('common.error_unknown');
                const finalMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
                setResult({ type: 'error', message: t('push.errors.send_failed', { message: finalMessage }) });
            }
        } catch (error) {
            /* 发送剪切板失败: {{message}} */
            const errorMessage = error instanceof Error ? error.message : t('common.error_unknown'); // 未知错误
            const finalMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
            setResult({
                type: 'error',
                message: t('push.errors.clipboard_failed', { message: finalMessage })
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

    const handleAddDevice = async (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => {
        try {
            const newDevice = await onAddDevice(alias, apiURL, authorization);
            setSelectedDevice(newDevice);
            setDeviceDialogOpen(false);
        } catch (error) {
            setResult({
                type: 'error',
                message: t('push.errors.add_device', { message: error instanceof Error ? error.message : '未知错误' })
            });
        }
    };

    // 处理自定义参数变化
    const handleAdvancedParamsChange = (params: Record<string, any> | undefined) => {
        setAdvancedParams(params);
    };

    // 检测是否需要自动打开添加设备对话框
    const [shouldAutoAddDevice, setShouldAutoAddDevice] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const autoAddDevice = urlParams.get('autoAddDevice') === 'true';

        if (autoAddDevice && devices.length === 0) {
            setShouldAutoAddDevice(true);
            // 移除网址参数
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [devices.length]);

    useLayoutEffect(() => {
        if (shouldAutoAddDevice) {
            // 读取剪切板内容到输入框
            const loadClipboardContent = async () => {
                try {
                    const clipboardText = await readClipboard();
                    if (clipboardText && clipboardText.trim()) {
                        setMessage(clipboardText.trim());
                        // 更新本地存储
                        localStorage.setItem('bark-sender-draft-message', clipboardText.trim());
                    }
                } catch (error) {
                    console.debug('读取剪切板失败:', error);
                }
            };

            loadClipboardContent();
            setDeviceDialogOpen(true);
            setShouldAutoAddDevice(false); // 重置状态
        }
    }, [shouldAutoAddDevice]);

    // 检测URL参数
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const useUrlDialog = params.get('useUrlDialog') === 'true';

        if (useUrlDialog) {
            // 从 storage.local 读取 URL 数据
            browser.storage.local.get('bark_url_data').then((result) => {
                if (result.bark_url_data) {
                    setUrlParams(result.bark_url_data);
                    setUrlDialogOpen(true);
                    // 使用完后清除数据
                    browser.storage.local.remove('bark_url_data');
                }
            });
            // 清除 URL 参数
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // URL Dialog 成功发送
    const handleUrlDialogSuccess = (message: string, uuid: string) => {
        setLastPushUuid(uuid);
        setResult({ type: 'success', message: t('push.success') });
        setMessage(message);
    };

    // URL Dialog 发送错误
    const handleUrlDialogError = (error: string) => {
        setResult({ type: 'error', message: error });
    };

    return (
        <>
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Paper
                    ref={paperRef}
                    elevation={2}
                    sx={{
                        p: 3,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        transformOrigin: 'center center'
                    }}
                >
                    <Typography variant="h6" gutterBottom>
                        {/* 发送推送消息 */}
                        {t('push.title')}
                    </Typography>

                    {isApiV2 ? (
                        <DeviceSelectV2
                            devices={devices}
                            selectedDevices={selectedDevices}
                            onDevicesChange={setSelectedDevices}
                            onAddClick={() => setDeviceDialogOpen(true)}
                        />
                    ) : (
                        <DeviceSelect
                            devices={devices}
                            selectedDevice={selectedDevice}
                            onDeviceChange={setSelectedDevice}
                            onAddClick={() => setDeviceDialogOpen(true)}
                        />
                    )}

                    <TextField
                        /* 推送内容 */
                        label={t('push.message')}
                        /* 输入要推送的消息内容 */
                        placeholder={t('push.message_placeholder')}
                        multiline
                        rows={3}
                        value={message}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        variant="outlined"
                        size="small"
                        fullWidth
                        autoFocus
                    />

                    {result && (
                        <Alert
                            severity={result.type}
                            action={
                                result.type === 'success' && lastPushUuid ? (
                                    <Stack direction="row" gap={1}>
                                        <Tooltip title={recallLoading ? t('push.recall.loading') : t('push.recall.button')}>
                                            <IconButton
                                                size="small"
                                                aria-label="recall"
                                                color="warning"
                                                onClick={handleRecall}
                                                disabled={recallLoading}
                                            >
                                                {recallLoading ? <CircularProgress size={16} /> : <UndoIcon sx={{ fontSize: '1em' }} />}
                                            </IconButton>
                                        </Tooltip>
                                        <IconButton
                                            size="small"
                                            aria-label="close"
                                            color="inherit"
                                            onClick={() => setResult(null)}
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ) : (
                                    <IconButton
                                        size="small"
                                        aria-label="close"
                                        color="inherit"
                                        onClick={() => setResult(null)}
                                    >
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                )
                            }
                        >
                            {result.message}
                        </Alert>
                    )}

                    <Stack spacing={2} sx={{ mt: 'auto' }}>
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
                            onClick={handleSend}
                            disabled={loading || clipboardLoading || (isApiV2 && selectedDevices.length === 0) || (!isApiV2 && !selectedDevice) || !message.trim()}
                            fullWidth
                            id="send-button"
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

                {/* 自定义参数, 传递 paperRef */}
                <AdvancedParamsEditor
                    onChange={handleAdvancedParamsChange}
                    paperRef={paperRef}
                />

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
                            {isApiV2 ? (
                                <DeviceSelectV2
                                    showLabel={false}
                                    devices={devices}
                                    selectedDevices={selectedDevices}
                                    onDevicesChange={setSelectedDevices}
                                    onAddClick={() => {
                                        setShortcutDialogOpen(false);
                                        setDeviceDialogOpen(true);
                                    }}
                                />
                            ) : (
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
                            )}
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
                        disabled={loading || !shortcutClipboardText.trim() || (isApiV2 && selectedDevices.length === 0) || (!isApiV2 && !selectedDevice)}
                        ref={sendButtonRef}
                    >
                        {/* 发送中... / 发送 */}
                        {loading ? t('push.sending') : t('push.send')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* URL选择Dialog */}
            {isApiV2 ? (
                <UrlDialogV2
                    open={urlDialogOpen}
                    onClose={() => setUrlDialogOpen(false)}
                    urlParams={urlParams}
                    selectedDevices={selectedDevices}
                    devices={devices}
                    onDevicesChange={setSelectedDevices}
                    onDeviceAdd={() => {
                        setUrlDialogOpen(false);
                        setDeviceDialogOpen(true);
                    }}
                    onSuccess={handleUrlDialogSuccess}
                    onError={handleUrlDialogError}
                />
            ) : (
                <UrlDialog
                    open={urlDialogOpen}
                    onClose={() => setUrlDialogOpen(false)}
                    urlParams={urlParams}
                    selectedDevice={selectedDevice}
                    devices={devices}
                    onDeviceChange={setSelectedDevice}
                    onDeviceAdd={() => {
                        setUrlDialogOpen(false);
                        setDeviceDialogOpen(true);
                    }}
                    onSuccess={handleUrlDialogSuccess}
                    onError={handleUrlDialogError}
                />
            )}

            {/* 添加设备Dialog */}
            <DeviceDialog
                open={deviceDialogOpen}
                onClose={() => setDeviceDialogOpen(false)}
                onSubmit={handleAddDevice}
            />
        </>
    );
} 