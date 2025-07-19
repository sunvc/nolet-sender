import React from 'react';
import { Box, Typography, Stack, Link } from '@mui/material';
import { Player } from '@lottiefiles/react-lottie-player';
import { useTranslation } from 'react-i18next';

export default function History() {
    const { t } = useTranslation();

    return (
        <Box
            sx={{
                p: 2,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <Stack spacing={2} alignItems="center">
                <Player
                    autoplay
                    loop
                    src="/lottie/coming-soon.json"
                    style={{ height: '200px', width: '200px' }}
                />
                <Typography variant="h6" color="text.secondary">
                    {/* 功能开发中 */}
                    {t('history.coming_soon')}
                </Typography>
                <Stack direction="column" spacing={0}>
                    <Typography variant="body2" color="text.secondary" align="center">
                        {/* 历史消息功能即将上线 */}
                        {t('history.description')}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Typography variant="body2" color="text.secondary" align="center">
                            {/* 你可以关注 */}
                            {t('history.follow')}
                        </Typography>
                        <Link href="https://t.me/bark_sender" target="_blank" rel="noopener noreferrer" variant="caption">
                            <Typography variant="body2" color="text.secondary" align="center">
                                {/* Telegram 频道 */}
                                {t('history.telegram')}
                            </Typography>
                        </Link>
                        <Typography variant="body2" color="text.secondary" align="center">
                            {/* 获取最新动态 */}
                            {t('history.updates')}
                        </Typography>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );
} 