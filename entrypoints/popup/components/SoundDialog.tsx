import React, { useState, useEffect, forwardRef } from 'react';
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
    Slide,
    Grid
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useTranslation } from 'react-i18next';
import { Sound } from '../types';

const Transition = forwardRef(function Transition(
    props: TransitionProps & {
        children: React.ReactElement<any, any>;
    },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const sounds: Sound[] = [
    {
        name: "silence",
        duration: "0s",
        description: "静音"
    },
    {
        name: "alarm",
        duration: "3s",
        description: "警报声"
    },
    {
        name: "anticipate",
        duration: "2s",
        description: "期待声"
    },
    {
        name: "bell",
        duration: "4s",
        description: "铃声"
    },
    {
        name: "birdsong",
        duration: "3s",
        description: "鸟鸣声"
    },
    {
        name: "bloom",
        duration: "2s",
        description: "绽放声"
    },
    {
        name: "calypso",
        duration: "2s",
        description: "卡利普索"
    },
    {
        name: "chime",
        duration: "3s",
        description: "风铃声"
    },
    {
        name: "choo",
        duration: "2s",
        description: "火车声"
    },
    {
        name: "descent",
        duration: "3s",
        description: "下降声"
    },
    {
        name: "electronic",
        duration: "2s",
        description: "电子声"
    },
    {
        name: "fanfare",
        duration: "2s",
        description: "号角声"
    },
    {
        name: "glass",
        duration: "2s",
        description: "玻璃声"
    },
    {
        name: "gotosleep",
        duration: "4s",
        description: "睡眠声"
    },
    {
        name: "healthnotification",
        duration: "2s",
        description: "健康提醒"
    },
    {
        name: "horn",
        duration: "2s",
        description: "喇叭声"
    },
    {
        name: "ladder",
        duration: "3s",
        description: "阶梯声"
    },
    {
        name: "mailsent",
        duration: "3s",
        description: "邮件发送"
    },
    {
        name: "minuet",
        duration: "3s",
        description: "小步舞曲"
    },
    {
        name: "multiwayinvitation",
        duration: "2s",
        description: "多方邀请"
    },
    {
        name: "newmail",
        duration: "4s",
        description: "新邮件"
    },
    {
        name: "newsflash",
        duration: "3s",
        description: "新闻快讯"
    },
    {
        name: "noir",
        duration: "3s",
        description: "黑色风格"
    },
    {
        name: "paymentsuccess",
        duration: "2s",
        description: "支付成功"
    },
    {
        name: "shake",
        duration: "2s",
        description: "震动声"
    },
    {
        name: "sherwoodforest",
        duration: "2s",
        description: "舍伍德森林"
    },
    {
        name: "spell",
        duration: "2s",
        description: "咒语声"
    },
    {
        name: "suspense",
        duration: "3s",
        description: "悬疑声"
    },
    {
        name: "telegraph",
        duration: "3s",
        description: "电报声"
    },
    {
        name: "tiptoes",
        duration: "2s",
        description: "脚尖声"
    },
    {
        name: "typewriters",
        duration: "2s",
        description: "打字机声"
    },
    {
        name: "update",
        duration: "2s",
        description: "更新提示"
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
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slots={{
                transition: Transition,
            }}
            keepMounted
        >
            <DialogTitle>
                {/* 铃声设置 */}
                {t('settings.sound.title')}
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        {/* 选择推送时使用的铃声，留空则用默认铃声 */}
                        {t('settings.sound.description')}
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid
                            size={{
                                xs: 12,
                            }}
                        >
                            <List dense>
                                <ListItem>
                                    <ListItemAvatar>
                                        <Avatar>
                                            <VolumeUpIcon />
                                        </Avatar>
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
                                    <ListItem key={sound.name}>
                                        <ListItemAvatar>
                                            <Avatar>
                                                <VolumeUpIcon />
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={sound.description}
                                            secondary={`${sound.name} (${sound.duration})`}
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
                <Button onClick={handleClear} color="error">
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
        </Dialog>
    );
} 