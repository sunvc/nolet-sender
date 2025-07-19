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
    Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { useTranslation } from 'react-i18next';
import { Device } from '../types';
import { validateApiURL } from '../utils/api';

const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const COMMON_DEVICE_NAMES = ['iphone', 'ipad', 'mac'];

interface DeviceDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (alias: string, apiURL: string) => Promise<void>;
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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewURL, setPreviewURL] = useState('');

    // 当编辑设备时，填充表单
    useEffect(() => {
        if (editDevice) {
            setDeviceAlias(editDevice.alias);
            setDeviceApiURL(editDevice.apiURL);
        } else {
            setDeviceAlias('');
            setDeviceApiURL('');
        }
        setError('');
    }, [editDevice, open]);

    // 当API URL变化时更新预览URL
    useEffect(() => {
        if (deviceApiURL.trim()) {
            try {
                const formattedURL = validateApiURL(deviceApiURL.trim())
                    ? deviceApiURL.trim()
                    : '';
                setPreviewURL(formattedURL ? `${formattedURL}测试消息` : '');
            } catch (error) {
                setPreviewURL('');
            }
        } else {
            setPreviewURL('');
        }
    }, [deviceApiURL]);

    const handleSubmit = async () => {
        if (!deviceAlias.trim()) {
            setError('请输入设备别名');
            return;
        }

        if (!deviceApiURL.trim()) {
            setError('请输入API URL');
            return;
        }

        if (!validateApiURL(deviceApiURL.trim())) {
            setError('API URL格式不正确，请检查格式');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onSubmit(deviceAlias.trim(), deviceApiURL.trim());
            onClose();
        } catch (error) {
            setError(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
                        onChange={(e) => setDeviceApiURL(e.target.value)}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={2}
                        error={!!error && error.includes('API URL')}
                        helperText={
                            error && error.includes('API URL')
                                ? error
                                : previewURL
                                    ? <Typography
                                        variant="caption"
                                        component="span"
                                        sx={{
                                            display: 'block',
                                            wordBreak: 'break-all',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {/* 预览地址: {{url}} */}
                                        {t('device.preview_url', { url: previewURL })}
                                    </Typography>
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
                            error={!!error && error.includes('设备别名')}
                            helperText={
                                error && error.includes('设备别名')
                                    ? error
                                    : t('device.name_helper')
                            }
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

                    {error && !error.includes('API URL') && !error.includes('设备别名') && (
                        <Typography color="error" variant="body2">
                            {error}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                {/* 取消 */}
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || !deviceAlias.trim() || !deviceApiURL.trim()}
                >
                    {loading ? t('common.processing') : editDevice ? t('common.save') : t('common.add')}
                </Button>
            </DialogActions>
        </Dialog>
    );
} 