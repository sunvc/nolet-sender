import { PushResponse } from '../types';
import { getAppSettings } from './settings';
import { encryptAESCBC, generateIV } from './crypto';

// 发送推送消息 - 通过background script
export async function sendPushMessage(apiURL: string, message: string): Promise<PushResponse> {
    try {
        // 检查是否启用加密
        const settings = await getAppSettings();

        if (settings.enableEncryption && settings.encryptionConfig?.key) {
            // 使用加密发送
            return await sendEncryptedPushMessage(apiURL, message, settings.encryptionConfig, settings.sound);
        } else {
            // 使用原有的GET方式发送
            return await sendPlainPushMessage(apiURL, message, settings.sound);
        }
    } catch (error) {
        console.error('发送推送失败:', error);
        throw error;
    }
}

// 发送明文推送消息
async function sendPlainPushMessage(apiURL: string, message: string, sound?: string): Promise<PushResponse> {
    try {
        // 构建URL，添加sound参数
        let url = `${apiURL}${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
        if (sound) {
            url += `&sound=${encodeURIComponent(sound)}`;
        }
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
                message,
                sound,
                url: undefined, // 可选
                title: undefined // 可选
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

// 发送加密推送消息
async function sendEncryptedPushMessage(apiURL: string, message: string, encryptionConfig: any, sound?: string): Promise<PushResponse> {
    try {
        // 生成随机 IV
        const iv = generateIV();

        const encryptData: any = {
            body: message
        };
        if (sound) {
            encryptData.sound = sound;
        }

        const plaintext = JSON.stringify(encryptData);
        const ciphertext = await encryptAESCBC(plaintext, encryptionConfig.key, iv); // 加密消息

        console.log('发送加密请求到:', apiURL);
        console.log('IV:', iv);
        console.log('Ciphertext:', ciphertext);

        const formData = new URLSearchParams();
        formData.append('iv', iv);
        formData.append('ciphertext', ciphertext);

        // 发送加密请求
        const response = await fetch(`${apiURL}?sound=${sound}`, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Bark-Browser-Extension/1.0'
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: PushResponse = await response.json();
        console.log('加密请求成功:', data);
        return data;
    } catch (error) {
        console.error('加密请求失败，尝试通过background script:', error);

        // 如果直接请求失败，通过background script发送
        try {
            const response = await sendMessageToBackground({
                action: 'sendEncryptedPush',
                apiURL,
                message,
                encryptionConfig,
                sound,
                url: undefined, // 可选
                title: undefined // 可选
            });

            if (response.success) {
                return response.data;
            } else {
                throw new Error(response.error || '未知错误');
            }
        } catch (bgError) {
            console.error('Background script加密请求也失败:', bgError);
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