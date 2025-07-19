import { PushResponse } from '../types';

// 发送推送消息 - 通过background script
export async function sendPushMessage(apiURL: string, message: string): Promise<PushResponse> {
    try {
        // 直接尝试fetch，如果失败则通过background script
        const url = `${apiURL}${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
        console.log('发送请求到:', url);

        // 尝试直接请求
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'User-Agent': 'Bark-Browser-Extension/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: PushResponse = await response.json();
        console.log('请求成功:', data);
        return data;
    } catch (error) {
        console.error('直接请求失败，尝试通过background script:', error);

        // 如果直接请求失败，通过background script发送
        try {
            const response = await sendMessageToBackground({
                action: 'sendPush',
                apiURL,
                message
            });

            if (response.success) {
                return response.data;
            } else {
                throw new Error(response.error || '未知错误');
            }
        } catch (bgError) {
            console.error('Background script请求也失败:', bgError);
            throw new Error('网络请求失败，请检查网络连接和API地址');
        }
    }
}

// 向background script发送消息
async function sendMessageToBackground(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
        // 检查是否有chrome runtime
        const runtime = (window as any).chrome?.runtime || (window as any).browser?.runtime;

        if (!runtime) {
            reject(new Error('扩展运行时不可用'));
            return;
        }

        runtime.sendMessage(message, (response: any) => {
            if (runtime.lastError) {
                reject(new Error(runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// 格式化API URL
export function formatApiURL(url: string): string {
    let formattedUrl = url.trim();

    // 如果没有协议，添加https://
    if (!/^https?:\/\//.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
    }

    // 如果末尾没有斜杠，添加斜杠
    if (!formattedUrl.endsWith('/')) {
        formattedUrl += '/';
    }

    return formattedUrl;
}

// 验证API URL格式
export function validateApiURL(url: string): boolean {
    try {
        // 首先格式化URL
        const formattedUrl = formatApiURL(url);
        const urlObj = new URL(formattedUrl);

        // 检查协议是否为http或https
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return false;
        }

        // 检查是否有hostname
        if (!urlObj.hostname) {
            return false;
        }

        // 检查路径是否有内容（除了斜杠）
        if (urlObj.pathname === '/') {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

// 生成预览URL
export function generatePreviewURL(url: string): string {
    if (!url.trim()) return '';

    try {
        const formattedUrl = formatApiURL(url);
        return `${formattedUrl}[消息内容]?autoCopy=1&copy=[消息内容]`;
    } catch {
        return '无效的URL格式';
    }
} 