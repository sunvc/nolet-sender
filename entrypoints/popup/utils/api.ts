import { PushResponse } from '../types';
import { getAppSettings } from './settings';
import { recordPushHistory } from './database';
import { sendPush, getRequestParameters, generateUUID, PushParams, EncryptionConfig } from '../../shared/push-service';

/**
 * 发送推送消息 - 通过background script
 * @param apiURL 设备API URL
 * @param message 消息内容
 * @param deviceName 设备名称
 * @param sound 铃声
 * @param uuid 唯一标识符
 */
export async function sendPushMessage(apiURL: string, message: string, deviceName?: string, sound?: string, uuid?: string): Promise<PushResponse> {
    let response: PushResponse;
    let method: 'GET' | 'POST' = 'GET';
    let isEncrypted = false;
    let parameters: any[] = [];

    try {
        // 检查是否启用加密
        const settings = await getAppSettings();

        // 使用传入的UUID或生成新的
        const pushUuid = uuid || generateUUID();

        const pushParams: PushParams = {
            apiURL,
            message,
            sound: sound || settings.sound,
            uuid: pushUuid
        };

        // 根据是否启用加密选择发送方式
        if (settings.enableEncryption && settings.encryptionConfig?.key) {
            method = 'POST';
            isEncrypted = true;
            response = await sendPushDirectly(pushParams, settings.encryptionConfig);
        } else {
            method = 'GET';
            response = await sendPushDirectly(pushParams);
        }

        // 获取请求参数（用于历史记录）
        parameters = getRequestParameters(pushParams, isEncrypted);

        // 记录推送历史
        if (deviceName) {
            await recordPushHistory(
                message,
                apiURL,
                deviceName,
                response,
                method,
                {
                    sound: sound || settings.sound,
                    isEncrypted,
                    parameters,
                    uuid: pushUuid // 传递UUID给历史记录
                }
            );
        }

        return response;
    } catch (error) {
        console.error('发送推送失败:', error);

        // 记录失败的推送历史
        if (deviceName) {
            const errorResponse = {
                code: -1,
                message: error instanceof Error ? error.message : '未知错误',
                timestamp: Date.now()
            };

            try {
                await recordPushHistory(
                    message,
                    apiURL,
                    deviceName,
                    errorResponse,
                    method,
                    {
                        isEncrypted,
                        parameters
                    }
                );
            } catch (dbError) {
                console.error('记录历史失败:', dbError);
            }
        }

        throw error;
    }
}

/**
 * 直接发送推送（优先直接请求，失败时回退到background script）
 */
async function sendPushDirectly(params: PushParams, encryptionConfig?: EncryptionConfig): Promise<PushResponse> {
    try {
        // 尝试直接发送
        return await sendPush(params, encryptionConfig);
    } catch (error) {
        console.error('直接请求失败，尝试通过background script:', error);

        // 如果直接请求失败，通过background script发送
        try {
            const action = encryptionConfig ? 'sendEncryptedPush' : 'sendPush';
            const message: any = {
                action,
                apiURL: params.apiURL,
                message: params.message,
                sound: params.sound,
                url: params.url,
                title: params.title,
                uuid: params.uuid // 传递UUID给background script
            };

            if (encryptionConfig) {
                message.encryptionConfig = encryptionConfig;
            }

            const response = await sendMessageToBackground(message);

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