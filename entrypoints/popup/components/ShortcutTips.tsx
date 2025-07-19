import React, { useEffect, useRef, useState } from 'react';
import { Typography } from '@mui/material';
import gsap from 'gsap';

interface ShortcutTip {
    key: string;
    description: string;
}

interface ShortcutTipsProps {
    tips: ShortcutTip[];
    interval?: number;
}

export default function ShortcutTips({
    tips,
    interval = 10000 // 默认10秒切换一次
}: ShortcutTipsProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const timeline = useRef<gsap.core.Timeline | null>(null);

    useEffect(() => {
        if (!containerRef.current || !textRef.current || tips.length <= 1) return;

        const animate = () => {
            if (timeline.current) {
                timeline.current.kill();
            }

            timeline.current = gsap.timeline()
                .to(textRef.current, {
                    duration: 0.5,
                    rotateX: -90,
                    opacity: 0,
                    ease: 'power1.in',
                    onComplete: () => {
                        setCurrentIndex((prev) => (prev + 1) % tips.length);
                    }
                })
                .set(textRef.current, { rotateX: 90 })
                .to(textRef.current, {
                    duration: 0.5,
                    rotateX: 0,
                    opacity: 1,
                    ease: 'power1.out'
                });
        };

        const intervalId = setInterval(animate, interval);

        return () => {
            clearInterval(intervalId);
            if (timeline.current) {
                timeline.current.kill();
            }
        };
    }, [tips, interval]);

    if (!tips.length) return null;

    return (
        <div
            ref={containerRef}
            style={{
                perspective: '1000px',
                height: '20px',
                overflow: 'hidden'
            }}
        >
            <div
                ref={textRef}
                style={{
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden'
                }}
            >
                <Typography
                    variant="caption"
                    color="text.secondary"
                    textAlign="center"
                    component="div"
                    sx={{ display: 'block' }}
                >
                    Tips: {tips[currentIndex].key} {tips[currentIndex].description}
                </Typography>
            </div>
        </div>
    );
} 