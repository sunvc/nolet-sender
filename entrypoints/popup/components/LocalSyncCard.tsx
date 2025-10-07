import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';
import RestoreIcon from '@mui/icons-material/Restore';
import { Device, ThemeMode } from '../types';
import BackupDialog from './BackupDialog';
import RestoreDialog from './RestoreDialog';
import { useTranslation } from 'react-i18next';

interface LocalSyncCardProps {
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

export default function LocalSyncCard({
    devices,
    defaultDeviceId,
    onSettingsChange,
    onAddDevice,
    onEditDevice,
    onSetDefaultDevice,
    onThemeChange
}: LocalSyncCardProps) {
    const [backupDialogOpen, setBackupDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const { t } = useTranslation();
    return (
        <>
            <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <FolderIcon />
                    {/* 本地同步 */}
                    {t('backup.local')}
                </Typography>

                <List sx={{ px: 0 }}>
                    <ListItem disablePadding>
                        <ListItemButton onClick={() => setBackupDialogOpen(true)}>
                            <ListItemIcon>
                                <SettingsBackupRestoreIcon color="primary" />
                            </ListItemIcon>
                            <ListItemText
                                primary={t('backup.backup')}
                                secondary={t('backup.backup_description')}
                            />
                        </ListItemButton>
                    </ListItem>

                    <ListItem disablePadding>
                        <ListItemButton onClick={() => setRestoreDialogOpen(true)}>
                            <ListItemIcon>
                                <RestoreIcon color="warning" />
                            </ListItemIcon>
                            <ListItemText
                                primary={t('backup.restore')}
                                secondary={t('backup.restore_description')}
                            />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Paper>

            {/* 备份对话框 */}
            <BackupDialog
                open={backupDialogOpen}
                onClose={() => setBackupDialogOpen(false)}
                devices={devices}
                defaultDeviceId={defaultDeviceId}
            />

            {/* 还原对话框 */}
            <RestoreDialog
                open={restoreDialogOpen}
                onClose={() => setRestoreDialogOpen(false)}
                devices={devices}
                defaultDeviceId={defaultDeviceId}
                onSettingsChange={onSettingsChange}
                onAddDevice={onAddDevice}
                onEditDevice={onEditDevice}
                onSetDefaultDevice={onSetDefaultDevice}
                onThemeChange={onThemeChange}
            />
        </>
    );
}
