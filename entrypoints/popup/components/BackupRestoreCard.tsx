import React, { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';

import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { Device, AppSettings, ThemeMode } from '../types';
import LocalSyncCard from './LocalSyncCard';
import CloudSyncCard from './CloudSyncCard';
import RestoreDialog from './RestoreDialog';
import { useTranslation } from 'react-i18next';
import SyncIcon from '@mui/icons-material/Sync';
import Button from '@mui/material/Button';
import { Chip } from '@mui/material';

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<unknown>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="left" ref={ref} {...props} />;
});

interface BackupRestoreCardProps {
    devices: Device[];
    defaultDeviceId: string;
    onSettingsChange?: () => void;
    // 设备操作函数
    onAddDevice?: (alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => Promise<Device>;
    onEditDevice?: (oldDeviceId: string, alias: string, apiURL: string, authorization?: { type: 'basic'; user: string; pwd: string; value: string; }) => Promise<Device>;
    onSetDefaultDevice?: (deviceId: string) => Promise<void>;
    // 主题操作函数
    onThemeChange?: (mode: ThemeMode) => void;
}

export interface BackupData {
    version: string;
    runId: string;
    userAgent: string;
    encrypted: boolean;
    passwordHint?: string;
    timestamp: number;
    data?: {
        devices: Device[];
        defaultDeviceId: string;
        appSettings: AppSettings;
        language: string;
    };
    // 加密数据字段
    encryptedData?: string;
    iv?: string;
    salt?: string;
}

export default function BackupRestoreCard({
    devices,
    defaultDeviceId,
    onSettingsChange,
    onAddDevice,
    onEditDevice,
    onSetDefaultDevice,
    onThemeChange
}: BackupRestoreCardProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [cloudBackupData, setCloudBackupData] = useState<BackupData | null>(null);
    const { t } = useTranslation();
    const handleClose = () => {
        setDialogOpen(false);
    };

    // 处理云端备份数据准备就绪
    const handleCloudBackupDataReady = (backupData: BackupData) => {
        setCloudBackupData(backupData);
    };

    return (
        <>
            <Paper sx={{ p: 0 }}>
                <Button onClick={() => setDialogOpen(true)}
                    sx={{ width: '100%', justifyContent: 'space-between' }}>
                    <Stack direction="row" justifyContent="space-between"
                        sx={{ px: 2, py: 1.5, width: '100%' }}>
                        <Typography variant="h6" color="textPrimary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SyncIcon />
                            {t('backup.title')}
                            <Chip label="Beta" size="small" variant="outlined" color="warning" />
                        </Typography>
                        <NavigateNextIcon />
                    </Stack>
                </Button>
            </Paper >

            {/* 全屏对话框 */}
            < Dialog
                open={dialogOpen}
                slots={{
                    transition: Transition,
                }
                }
                onClose={handleClose}
                fullScreen
                sx={{ '& .MuiDialog-paper': { borderRadius: 0, border: 'none' } }}
            >
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar variant="dense">
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={handleClose}
                            aria-label="close"
                        >
                            <ArrowBackIosNewIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {t('backup.title')}
                        </Typography>
                    </Toolbar>
                </AppBar>

                {/* 内容区域 */}
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
                        {/* 本地同步卡片 */}
                        <LocalSyncCard
                            devices={devices}
                            defaultDeviceId={defaultDeviceId}
                            onSettingsChange={onSettingsChange}
                            onAddDevice={onAddDevice}
                            onEditDevice={onEditDevice}
                            onSetDefaultDevice={onSetDefaultDevice}
                            onThemeChange={onThemeChange}
                        />

                        {/* 云同步卡片 */}
                        <CloudSyncCard onBackupDataReady={handleCloudBackupDataReady} />
                    </Stack>
                </Box>
            </Dialog >

            {/* 云端还原对话框 */}
            < RestoreDialog
                open={!!cloudBackupData
                }
                onClose={() => setCloudBackupData(null)}
                devices={devices}
                defaultDeviceId={defaultDeviceId}
                onSettingsChange={onSettingsChange}
                onAddDevice={onAddDevice}
                onEditDevice={onEditDevice}
                onSetDefaultDevice={onSetDefaultDevice}
                onThemeChange={onThemeChange}
                cloudBackupData={cloudBackupData}
            />
        </>
    );
}
