import React, { useState } from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    SelectChangeEvent,
    Stack,
    Divider
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { Device } from '../types';

interface DeviceSelectProps {
    devices: Device[];
    selectedDevice: Device | null;
    onDeviceChange: (device: Device | null) => void;
    onAddClick: () => void;
    label?: string;
    placeholder?: string;
    showLabel?: boolean;
}

export default function DeviceSelect({
    devices,
    selectedDevice,
    onDeviceChange,
    onAddClick,
    label = '选择设备',
    placeholder = '请选择一个设备',
    showLabel = true
}: DeviceSelectProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const handleChange = (event: SelectChangeEvent<string>) => {
        const deviceId = event.target.value;
        const device = devices.find(d => d.id === deviceId) || null;
        onDeviceChange(device);
    };

    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(false);
        onAddClick();
    };

    return (
        <FormControl fullWidth variant="outlined" size="small">
            {showLabel && <InputLabel
                shrink
                sx={{
                    backgroundColor: 'background.paper',
                    px: 0.5,
                    '&.MuiInputLabel-shrink': {
                        transform: 'translate(14px, -9px) scale(0.75)'
                    }
                }}
            >
                {/* 目标设备 */}
                {t('push.target_device')}
            </InputLabel>}
            <Select
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                value={selectedDevice?.id || ''}
                onChange={handleChange}
                label={showLabel ? t('push.target_device') : undefined}
                displayEmpty
                notched
                MenuProps={{
                    PaperProps: {
                        sx: {
                            maxHeight: 300,
                            display: 'flex',
                            flexDirection: 'column',
                            '& .MuiList-root': {
                                flex: '1 1 auto',
                                overflow: 'auto'
                            }
                        }
                    }
                }}
            >
                {devices.length === 0 ?
                    <MenuItem disabled value="">
                        <em>{t('push.select_device')}</em>
                    </MenuItem> :
                    <Typography color="text.secondary" variant="overline" sx={{
                        px: 1, pt: 1, userSelect: 'none'
                    }}>
                        {/* 选择要发送推送的设备 */}
                        {t('push.select_device')}
                    </Typography>}
                {devices.map((device) => (
                    <MenuItem key={device.id} value={device.id}>
                        <Stack sx={{ width: '100%' }}>
                            <Typography variant="body1">{device.alias}</Typography>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    fontSize: '0.75rem',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    wordBreak: 'break-all'
                                }}
                            >
                                {device.apiURL}
                            </Typography>
                        </Stack>
                    </MenuItem>
                ))}
                <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                    <Divider />
                    <MenuItem
                        onClick={handleAddClick}
                        sx={{
                            justifyContent: 'center',
                            p: 0,
                        }}
                    >
                        <Stack direction="row" alignItems="center" justifyContent="center"
                            sx={{ p: 0, color: 'primary.main' }}>
                            <AddIcon sx={{ mr: 1 }} />
                            {/* 添加新设备 */}
                            {t('device.add')}
                        </Stack>
                    </MenuItem>
                </Box>
            </Select>
        </FormControl>
    );
} 