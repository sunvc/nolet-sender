import { PushResponse, EncryptionAlgorithm } from '../popup/types';

/**
 * 推送参数接口
 */
export interface PushParams {
    apiURL: string;
    message: string;
    sound?: string;
    url?: string;
    title?: string;
    uuid?: string; // 作为请求参数里的 id 作为唯一标识, 这个 id 后续修改撤回功能会用到
}

/**
 * 加密配置接口
 */
export interface EncryptionConfig {
    key: string;
}

/**
 * 加密推送参数接口
 */
export interface EncryptedPushParams extends PushParams {
    encryptionConfig: EncryptionConfig;
}

/**
 * 生成 UUID
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 生成指定长度 ASCII 字符串
 */
function generateAsciiString(len: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => charset[b % charset.length]).join('');
}

/**
 * 根据算法获取 KEY 长度
 */
function getKeyLength(algorithm: EncryptionAlgorithm): number {
    switch (algorithm) {
        case 'AES128':
            return 16;
        case 'AES192':
            return 24;
        case 'AES256':
            return 32;
        default:
            return 32;
    }
}

/**
 * 生成 KEY
 */
export function generateKey(algorithm: EncryptionAlgorithm): string {
    const keyLength = getKeyLength(algorithm);
    return generateAsciiString(keyLength);
}

/**
 * 生成 16 位随机 IV
 */
export function generateIV(): string {
    return generateAsciiString(16);
}

/**
 * 字符串转 UTF8 字节数组
 */
function toUtf8Bytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * ArrayBuffer 转 Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
}

/**
 * AES-CBC 加密
 */
export async function encryptAESCBC(plaintext: string, keyStr: string, ivStr: string): Promise<string> {
    const keyBytes = toUtf8Bytes(keyStr);
    const iv = toUtf8Bytes(ivStr);
    const data = toUtf8Bytes(plaintext);

    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: 'AES-CBC',
            iv: iv
        },
        cryptoKey,
        data
    );

    return arrayBufferToBase64(encryptedBuffer);
}

/**
 * 发送明文推送消息 (API v1)
 */
export async function sendPlainPush(params: PushParams): Promise<PushResponse> {
    const { apiURL, message, sound, url, title, uuid } = params;

    // 如果没有提供UUID，则生成一个（用于请求参数）
    const pushUuid = uuid || generateUUID();

    let requestUrl: string;

    // 根据是否有标题构建不同的 URL 格式
    if (title) {
        // 含标题格式: https://api.day.app/key/title/body?params
        requestUrl = `${apiURL}${encodeURIComponent(title)}/${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
    } else {
        // 默认格式: https://api.day.app/key/body?params  
        requestUrl = `${apiURL}${encodeURIComponent(message)}?autoCopy=1&copy=${encodeURIComponent(message)}`;
    }

    // 添加 UUID 参数
    requestUrl += `&id=${encodeURIComponent(pushUuid)}`;

    // 添加可选参数
    if (sound) {
        requestUrl += `&sound=${encodeURIComponent(sound)}`;
    }
    if (url) {
        requestUrl += `&url=${encodeURIComponent(url)}`;
    }

    console.debug('发送明文请求到:', requestUrl);

    const response = await fetch(requestUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: PushResponse = await response.json();
    console.debug('明文请求成功:', result);

    return result;
}

/**
 * 发送加密推送消息 (API v1)
 */
export async function sendEncryptedPush(params: EncryptedPushParams): Promise<PushResponse> {
    const { apiURL, message, sound, url, title, encryptionConfig, uuid } = params;

    const pushUuid = uuid || generateUUID();

    // 生成随机IV
    const iv = generateIV();

    // 构建加密内容
    const encryptData: any = { body: message };
    if (sound) {
        encryptData.sound = sound;
    }
    if (url) {
        encryptData.url = url;
    }
    if (title) {
        encryptData.title = title;
    }

    // 加密消息
    const plaintext = JSON.stringify(encryptData);
    const ciphertext = await encryptAESCBC(plaintext, encryptionConfig.key, iv);

    console.debug('发送加密请求到:', apiURL);
    console.debug('UUID:', pushUuid);
    console.debug('IV:', iv);
    console.debug('Ciphertext:', ciphertext);

    const formData = new URLSearchParams();
    formData.append('iv', iv);
    formData.append('ciphertext', ciphertext);
    formData.append('id', pushUuid);

    // 发送加密请求
    const response = await fetch(apiURL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: PushResponse = await response.json();
    console.debug('加密请求成功:', result);

    return result;
}

/**
 * 统一的推送服务 - 根据配置自动选择明文或加密方式
 */
export async function sendPush(params: PushParams, encryptionConfig?: EncryptionConfig): Promise<PushResponse> {
    if (encryptionConfig?.key) {
        // 使用加密方式
        return sendEncryptedPush({ ...params, encryptionConfig });
    } else {
        // 使用明文方式
        return sendPlainPush(params);
    }
}

/**
 * 获取请求参数列表（用于历史记录）
 */
export function getRequestParameters(params: PushParams, isEncrypted: boolean): Array<{ key: string; value: string }> {
    if (isEncrypted) {
        return [
            { key: 'iv', value: '***' }, // 加密参数隐藏
            { key: 'ciphertext', value: '***' },
            { key: 'id', value: params.uuid || '' },
            { key: 'sound', value: params.sound || '' }
        ];
    } else {
        const parameters = [
            { key: 'message', value: params.message },
            { key: 'autoCopy', value: '1' },
            { key: 'copy', value: params.message },
            { key: 'id', value: params.uuid || '' },
            { key: 'sound', value: params.sound || '' }
        ];

        if (params.title) {
            parameters.push({ key: 'title', value: params.title });
        }
        if (params.url) {
            parameters.push({ key: 'url', value: params.url });
        }

        return parameters;
    }
} 