import React, { useState, useEffect, } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Avatar,
    Radio,
    FormControlLabel,
    Typography,
    Grid,
    IconButton,
    Tooltip,
    Snackbar
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useTranslation } from 'react-i18next';
import { Sound } from '../types';
import { sendPushMessage } from '../utils/api';
import { generateID } from '../../shared/push-service';
import { SlideUpTransition } from './DialogTransitions';

const sounds: Sound[] = [
    {
        "name": "alarm",
        "duration": 1452
    },
    {
        "name": "aurora",
        "duration": 1200
    },
    {
        "name": "call",
        "duration": 2630
    },
    {
        "name": "com",
        "duration": 529
    },
    {
        "name": "craft",
        "duration": 602
    },
    {
        "name": "frog",
        "duration": 578
    },
    {
        "name": "glass",
        "duration": 644
    },
    {
        "name": "gold",
        "duration": 1176
    },
    {
        "name": "health",
        "duration": 1792
    },
    {
        "name": "hello",
        "duration": 614
    },
    {
        "name": "multiway",
        "duration": 2188
    },
    {
        "name": "popcorn",
        "duration": 904
    },
    {
        "name": "run",
        "duration": 813
    },
    {
        "name": "shake",
        "duration": 600
    },
    {
        "name": "silence",
        "duration": 200
    },
    {
        "name": "snap",
        "duration": 150
    },
    {
        "name": "success",
        "duration": 929
    },
    {
        "name": "trill",
        "duration": 1509
    },
    {
        "name": "tritone",
        "duration": 788
    },
    {
        "name": "typewriter",
        "duration": 1020
    },
    {
        "name": "xiu",
        "duration": 395
    }
];

interface SoundDialogProps {
    open: boolean;
    currentSound?: string;
    onClose: () => void;
    onSave: (sound: string) => void;
}

export default function SoundDialog({ open, currentSound, onClose, onSave }: SoundDialogProps) {
    const { t } = useTranslation();
    const [selectedSound, setSelectedSound] = useState<string>('');
    const [testingSound, setTestingSound] = useState<string>('');
    const [error, setError] = useState<string>('');

    // 重置状态
    useEffect(() => {
        if (open) {
            setSelectedSound(currentSound || '');
        }
    }, [open, currentSound]);

    // 处理铃声选择
    const handleSoundChange = (soundName: string) => {
        setSelectedSound(soundName);
    };

    // 测试铃声
    const handleTestSound = async (soundName: string, duration: number = 1000) => {
        try {
            setTestingSound(soundName);

            const devicesResult = await browser.storage.local.get('bark_devices');
            const defaultDeviceResult = await browser.storage.local.get('bark_default_device');

            const devices = devicesResult.bark_devices || [];
            const defaultDeviceId = defaultDeviceResult.bark_default_device || '';
            const defaultDevice = devices.find((device: any) => device.id === defaultDeviceId) || devices[0];

            if (!defaultDevice) {
                console.warn('未找到默认设备，无法测试铃声');
                return;
            }

            const testMessage = `${t('settings.sound.test_message', { sound: soundName })}`;
            await sendPushMessage(defaultDevice, testMessage, soundName, generateID());

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'push.errors.send_failed';
            const logMessage = errorMessage.startsWith('utils.api.') ? t(errorMessage) : errorMessage;
            console.error('测试铃声失败:', logMessage);
            setError(logMessage);
        } finally {
            setTimeout(() => {
                setTestingSound('');
            }, Math.max(duration, 1000)); // 最小等待 1s
        }
    };

    // 保存铃声设置
    const handleSave = () => {
        onSave(selectedSound);
        onClose();
    };

    // 清除铃声设置
    const handleClear = () => {
        onSave('');
        onClose();
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                slots={{
                    transition: SlideUpTransition,
                }}
                keepMounted
            >
                <DialogTitle>
                    {/* 铃声设置 */}
                    {t('settings.sound.title')}
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Typography variant="caption" color="text.secondary">
                            {/* 选择推送时使用的铃声，留空则用默认铃声 */}
                            {t('settings.sound.description')}
                            <br />
                            <Typography component="span" variant="caption" color="primary">
                                {/* 点击播放图标可测试铃声效果 */}
                                {t('settings.sound.description_2')}
                            </Typography>
                        </Typography>

                        <Grid container spacing={1}>
                            <Grid
                                size={{
                                    xs: 12,
                                }}
                            >
                                <List dense sx={{ userSelect: 'none', p: 0 }}>
                                    <ListItem sx={{ p: 0 }}>
                                        <ListItemAvatar>
                                            <Tooltip title={t('settings.sound.default')} placement='top'>
                                                <span>
                                                    <IconButton
                                                        disabled
                                                        size="small"
                                                    >
                                                        <Avatar sx={{ width: 32, height: 32 }}>
                                                            <VolumeUpIcon fontSize="small" />
                                                        </Avatar>
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={t('settings.sound.default')}
                                            secondary={t('settings.sound.default_description')}
                                        />
                                        <FormControlLabel
                                            value=""
                                            control={
                                                <Radio
                                                    checked={selectedSound === ''}
                                                    onChange={() => handleSoundChange('')}
                                                    size="small"
                                                />
                                            }
                                            label=""
                                            sx={{ m: 0 }}
                                        />
                                    </ListItem>

                                    {sounds.map((sound) => (
                                        <ListItem key={sound.name} sx={{ p: 0 }}>
                                            <ListItemAvatar style={{ pointerEvents: testingSound !== '' ? 'none' : 'auto' }}>
                                                <IconButton
                                                    onClick={() => handleTestSound(sound.name, sound.duration)}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: testingSound === sound.name ? 'ButtonHighlight' : 'transparent',
                                                    }}
                                                    style={{ outline: 'none' }}
                                                >
                                                    <Avatar sx={{
                                                        width: 32, height: 32,
                                                        // sound.name 为当前铃声
                                                        backgroundColor: testingSound === sound.name ? 'primary.main' : 'avatar.main',
                                                        '&:hover': {
                                                            backgroundColor: 'primary.main',
                                                        },
                                                    }}>
                                                        {testingSound === sound.name ? <VolumeUpIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                                                    </Avatar>
                                                </IconButton>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        <Typography>
                                                            {t(`settings.sound.${sound.name}`)}
                                                        </Typography>
                                                        {/* 新版 iOS 没有这些铃声, 但目前还能用 */}
                                                        {/* {sound.old && (
                                                        <Chip
                                                            label={t('settings.sound.deprecated')}
                                                            size="small"
                                                            variant="outlined"
                                                            color="warning"
                                                            sx={{ fontSize: '10px', height: '20px' }}
                                                        />
                                                    )} */}
                                                    </Stack>
                                                }
                                                secondary={`${sound.name} (${sound.duration / 1000}s)`}
                                            />
                                            <FormControlLabel
                                                value={sound.name}
                                                control={
                                                    <Radio
                                                        checked={selectedSound === sound.name}
                                                        onChange={() => handleSoundChange(sound.name)}
                                                        size="small"
                                                    />
                                                }
                                                label=""
                                                sx={{ m: 0 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Grid>
                        </Grid>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClear} color="error"
                        sx={{
                            mr: 'auto',
                        }}>
                        {/* 清除 */}
                        {t('settings.sound.clear')}
                    </Button>
                    <Button onClick={onClose}>
                        {/* 取消 */}
                        {t('common.cancel')}
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                    >
                        {/* 保存 */}
                        {t('common.save')}
                    </Button>
                </DialogActions>
            </Dialog >
            <Snackbar
                open={!!error}
                autoHideDuration={3000}
                onClose={() => setError('')}
                message={error}
            />
        </>
    );
} 