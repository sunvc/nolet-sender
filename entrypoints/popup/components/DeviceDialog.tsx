import React, { useState, useEffect, forwardRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
    Typography,
    Chip,
    Box,
    Slide,
    Collapse,
    Card,
    Divider
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useTranslation } from 'react-i18next';
import { Device } from '../types';
import { validateApiURL } from '../utils/api';
import { useAppContext } from '../contexts/AppContext';
import PingButton from "./PingButton";


const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const COMMON_DEVICE_NAMES = ['iphone', 'ipad', 'mac'];

// 截取第 4 个斜杠后的内容 (如果没有协议则截取第 2 个斜杠后的内容)
const truncateAfterFourthSlash = (url: string): string => {
    if (!url) return url;

    // 检查是否包含协议
    const hasProtocol = /^https?:\/\//.test(url);

    if (hasProtocol) {
        const match = url.match(/^(.*?\/.*?\/.*?\/.*?\/)/);
        return match ? match[1] : url;
    } else {
        const match = url.match(/^(.*?\/.*?\/)/);
        return match ? match[1] : url;
    }
};

interface DeviceDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string }) => Promise<void>;
    editDevice?: Device;
    title?: string;
}

export default function DeviceDialog({
    open,
    onClose,
    onSubmit,
    editDevice,
    title
}: DeviceDialogProps) {
    const { t } = useTranslation();
    const [deviceAlias, setDeviceAlias] = useState('');
    const [deviceApiURL, setDeviceApiURL] = useState('');
    const [basicAuthUsername, setBasicAuthUsername] = useState('');
    const [basicAuthPassword, setBasicAuthPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isBasicAuthCollapsed, setIsBasicAuthCollapsed] = useState(true);
    const { appSettings } = useAppContext();

    // 获取 enableBasicAuth 功能开关设置
    const enableBasicAuth = appSettings?.enableBasicAuth || false;

    // 当编辑设备时，填充表单
    useEffect(() => {
        if (editDevice) {
            setDeviceAlias(editDevice.alias);
            setDeviceApiURL(editDevice.apiURL);
            setBasicAuthUsername(editDevice.authorization?.user || '');
            setBasicAuthPassword(editDevice.authorization?.pwd || '');
            // 如果有认证信息，自动展开基本认证区域
            setIsBasicAuthCollapsed(!editDevice.authorization);
        } else {
            setDeviceAlias('');
            setDeviceApiURL('');
            setBasicAuthUsername('');
            setBasicAuthPassword('');
            setIsBasicAuthCollapsed(true);
        }
        setError('');
    }, [editDevice, open]);

    const handleSubmit = async () => {
        const truncatedURL = truncateAfterFourthSlash(deviceApiURL.trim());

        if (!validateApiURL(truncatedURL)) {
            setError(t('device.api_url_invalid'));
            return;
        }

        setLoading(true);
        setError('');

        try {

            let authorization;
            if (basicAuthUsername.trim() && basicAuthPassword.trim()) {
                const credentials = btoa(`${basicAuthUsername.trim()}:${basicAuthPassword.trim()}`);
                authorization = {
                    type: 'basic' as const,
                    user: basicAuthUsername.trim(),
                    pwd: basicAuthPassword.trim(),
                    value: `Basic ${credentials}`
                };
            }
            // truncatedURL 是截取后的URL, 格式为 `https://api.day.app/<device_key>/`
            await onSubmit(deviceAlias.trim(), truncatedURL, authorization);
            onClose();
        } catch (error) {
            // setError(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
            setError(t('common.operation_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slots={{
                transition: Transition,
            }}
            keepMounted
        >
            <DialogTitle>{title || t(editDevice ? 'device.edit' : 'device.add')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label={t('device.api_url')}
                        placeholder={t('device.api_url_placeholder')}
                        value={deviceApiURL}
                        onChange={(e) => {
                            setDeviceApiURL(e.target.value);
                            setError('');
                        }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={2}
                        error={!!error && error === t('device.api_url_invalid')}
                        helperText={
                            error === t('device.api_url_invalid')
                                ? error
                                : t('device.api_url_helper')
                        }
                    />

                    <Box>
                        <TextField
                            label={t('device.name')}
                            placeholder={t('device.name_placeholder')}
                            value={deviceAlias}
                            onChange={(e) => setDeviceAlias(e.target.value)}
                            variant="outlined"
                            fullWidth
                            helperText={t('device.name_helper')}
                        />
                        {!editDevice && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                {COMMON_DEVICE_NAMES.map((name) => (
                                    <Chip
                                        key={name}
                                        label={t(`device.common_names.${name}`)}
                                        onClick={() => setDeviceAlias(t(`device.common_names.${name}`))}
                                        variant="outlined"
                                        color="primary"
                                        size="small"
                                    />
                                ))}
                            </Stack>
                        )}
                    </Box>

                    {error && error !== t('device.api_url_invalid') && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}

                    {/* Basic Auth */}
                    {/* Basic Auth 认证区域 */}
                    <Box sx={{ display: enableBasicAuth ? 'block' : 'none' }}>
                        <Divider sx={{ mb: .5, px: 1.5, userSelect: 'none' }} >
                            <Box sx={{
                                fontSize: '0.625rem', cursor: 'pointer',
                            }} onClick={() => setIsBasicAuthCollapsed(!isBasicAuthCollapsed)}>
                                {t('device.basic_auth.title')}
                            </Box>
                        </Divider>
                        <Collapse in={!isBasicAuthCollapsed}>
                            <Card>
                                <Stack direction="column" gap={1.5} sx={{ px: 2, py: 1.5 }}>
                                    <TextField
                                        // label="用户名"
                                        // placeholder="输入用户名"
                                        label={t('device.basic_auth.username')}
                                        placeholder={t('device.basic_auth.username_placeholder')}
                                        value={basicAuthUsername}
                                        onChange={(e) => setBasicAuthUsername(e.target.value)}
                                        variant="standard"
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            inputLabel: {
                                                shrink: true  // 禁用浮动
                                            }
                                        }}
                                    />
                                    <TextField
                                        // label="密码"
                                        // placeholder="输入密码"
                                        label={t('device.basic_auth.password')}
                                        placeholder={t('device.basic_auth.password_placeholder')}
                                        type="text"
                                        value={basicAuthPassword}
                                        onChange={(e) => setBasicAuthPassword(e.target.value)}
                                        variant="standard"
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            inputLabel: {
                                                shrink: true  // 禁用浮动
                                            }
                                        }}
                                    />
                                </Stack>
                            </Card>
                        </Collapse>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                {/* 取消 */}
                <Box sx={{ mr: "auto", px: 1 }}>
                    <PingButton apiURL={deviceApiURL} />
                </Box>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || !deviceAlias.trim() || !deviceApiURL.trim()}
                >
                    {loading ? t('common.processing') : editDevice ? t('common.save') : t('common.add')}
                </Button>
            </DialogActions>
        </Dialog >
    );
} 