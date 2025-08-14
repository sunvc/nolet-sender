import { PushResponse, EncryptionAlgorithm } from '../popup/types';

/**
 * 消息体（最终发送给服务器的数据）
 */
export interface MessagePayload {
    body: string; // 推送内容（必需）
    title?: string; // 推送标题
    subtitle?: string; // 推送副标题
    device_key?: string;
    /* 设备 key，API v2 使用
        实际服务器根据请求头 Content-Type 来判断是 API v1 还是 API v2
        目前用的是 API v1, apiURL 格式为 = 服务器地址/:device_key/ device_key在:path 中
        如果后续 API v2 使用, 地址固定为 服务器地址/:push/ device_key在 body 中
     */
    device_keys?: string[]; // key数组，用于批量推送，API v2 使用
    level?: 'critical' | 'active' | 'timeSensitive' | 'passive';
    /* 推送中断级别：
        critical: 重要警告，在静音模式下也会响铃
        active: 默认值，系统会立即亮屏显示通知
        timeSensitive: 时效性通知，可在专注状态下显示通知
        passive: 仅将通知添加到通知列表，不会亮屏提醒
    */
    volume?: number; // 重要警告的通知音量，取值范围：0-10，不传默认值为5
    badge?: number; // 推送角标，可以是任意数字
    call?: '1'; // 传"1"时，通知铃声重复播放
    autoCopy?: '1'; // 传"1"时，iOS14.5以下自动复制推送内容，iOS14.5以上需手动长按推送或下拉推送
    copy?: string; // 复制推送时，指定复制的内容，不传此参数将复制整个推送内容
    sound?: string; // 可以为推送设置不同的铃声
    icon?: string; // 为推送设置自定义图标，设置的图标将替换默认Bark图标
    group?: string; // 对消息进行分组，推送将按group分组显示在通知中心中
    ciphertext?: string; // 加密推送的密文，API v2 使用
    isArchive?: '1'; // 传1保存推送，传其他的不保存推送，不传按APP内设置来决定是否保存
    url?: string; // 点击推送时，跳转的URL
    action?: 'none'; // 传"none"时，点击推送不会弹窗
    id?: string; // 作为请求参数里的id作为唯一标识，这个id后续修改撤回功能会用到
    delete?: '1'; // 传"1"配合id参数可以撤回推送
    iv?: string; // 加密推送的 iv，API v2 使用, API v1 放在 Form Data 中
}

/**
 * 推送参数接口（前端传入的数据）
 */
export interface PushParams {
    apiURL: string;
    message: string; // *必填* 对应 MessagePayload 中的 body
    sound?: string;
    url?: string;
    title?: string;
    uuid?: string; // 作为请求参数里的 id 作为唯一标识, 这个 id 后续修改撤回功能会用到 对应 MessagePayload 中的 id
    icon?: string;
    authorization?: {
        type: 'basic';
        user: string;
        pwd: string;
        value: string; // Basic <凭证>
    };
    // 添加其他 MessagePayload 参数
    subtitle?: string;
    device_key?: string;
    device_keys?: string[];
    level?: 'critical' | 'active' | 'timeSensitive' | 'passive';
    volume?: number;
    badge?: number;
    call?: '1';
    autoCopy?: '1';
    copy?: string;
    group?: string;
    isArchive?: '1';
    action?: 'none';
    delete?: '1';
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
        new Uint8Array(keyBytes),
        { name: 'AES-CBC' },
        false,
        ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: 'AES-CBC',
            iv: new Uint8Array(iv)
        },
        cryptoKey,
        new Uint8Array(data)
    );

    return arrayBufferToBase64(encryptedBuffer);
}

/**
 * 发送明文推送消息 (API v1)
 */
export async function sendPlainPush(msgPayload: MessagePayload, apiURL: string, authorization?: PushParams['authorization']): Promise<PushResponse> {
    const { body, title, ...queryParams } = msgPayload; // 剔除 路径参数 外的 body 和 title

    const baseUrl = `${apiURL}${title ?
        encodeURIComponent(title) + '/' : ''}${encodeURIComponent(body)}`;

    // 滤掉值为undefined的键值对
    const validParams = Object.entries(queryParams).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            if (Array.isArray(value)) {
                acc[key] = value.join(','); // 数组转为逗号分隔的字符串
            } else {
                acc[key] = String(value); // 其他类型转为字符串
            }
        }
        return acc;
    }, {} as Record<string, string>);

    const searchParams = new URLSearchParams(validParams);
    const requestUrl = `${baseUrl}?${searchParams.toString()}`;

    console.debug('发送明文请求到:', requestUrl);

    const headers: Record<string, string> = {};
    if (authorization && authorization.value) {
        headers['Authorization'] = authorization.value;
    }

    const response = await fetch(requestUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        ...(Object.keys(headers).length > 0 && { headers })
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
export async function sendEncryptedPush(msgPayload: MessagePayload, apiURL: string, authorization?: PushParams['authorization'], encryptionConfig?: EncryptionConfig): Promise<PushResponse> {
    if (!encryptionConfig?.key) {
        throw new Error('加密配置缺失');
    }

    const iv = generateIV();
    const plaintext = JSON.stringify(msgPayload);

    const ciphertext = await encryptAESCBC(plaintext, encryptionConfig.key, iv);

    console.debug('发送加密请求到:', apiURL);
    console.debug('UUID:', msgPayload.id);
    console.debug('IV:', iv);
    console.debug('Plaintext:', plaintext);
    console.debug('Ciphertext:', ciphertext);

    const formData = new URLSearchParams();
    formData.append('iv', iv);
    formData.append('ciphertext', ciphertext);
    formData.append('id', msgPayload.id || ''); // 不确定撤回是不是在这里读取的id, 也有可能在ciphertext中, 待以后验证

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded' // 表单数据 API v1 的(加密时)请求头, v2使用的是 application/json, bark-server 区别 API v1 和 v2 是根据 application/json
    };
    if (authorization && authorization.value) {
        headers['Authorization'] = authorization.value;
    }

    // 发送加密请求
    const response = await fetch(apiURL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers,
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
    // 构建消息体
    const msgPayload: MessagePayload = {
        // 基础参数
        id: params.uuid || generateUUID(),
        body: params.message,
        title: params.title,
        sound: params.sound,
        url: params.url,
        copy: params.copy || params.message,
        autoCopy: params.autoCopy || "1", // 默认开启自动复制推送内容
        icon: params.icon,
        // 其他参数
        subtitle: params.subtitle,
        device_key: params.device_key,
        device_keys: params.device_keys,
        level: params.level,
        volume: params.volume,
        badge: params.badge,
        call: params.call,
        group: params.group,
        isArchive: params.isArchive,
        action: params.action,
        delete: params.delete
    };

    if (encryptionConfig?.key) {
        // 使用加密方式
        return sendEncryptedPush(msgPayload, params.apiURL, params.authorization, encryptionConfig);
    } else {
        // 使用明文方式
        return sendPlainPush(msgPayload, params.apiURL, params.authorization);
    }
}

/**
 * 获取请求参数列表（用于历史记录）
 */
export function getRequestParameters(params: PushParams, isEncrypted: boolean): Array<{ key: string; value: string }> {
    // 构建基本参数对象
    const paramMap: Record<string, string | undefined> = {
        message: params.message,
        autoCopy: params.autoCopy || '1',
        copy: params.copy || params.message,
        id: params.uuid || '',
        sound: params.sound || '',
        title: params.title,
        url: params.url,
        subtitle: params.subtitle,
        device_key: params.device_key,
        device_keys: params.device_keys?.join(','),
        level: params.level,
        volume: params.volume?.toString(),
        badge: params.badge?.toString(),
        call: params.call,
        icon: params.icon,
        group: params.group,
        isArchive: params.isArchive,
        action: params.action,
        delete: params.delete
    };

    // 过滤有效参数并转换为数组格式
    const filteredParams = Object.entries(paramMap)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => ({ key, value: value as string }));

    // 如果是加密模式，添加加密相关参数
    if (isEncrypted) {
        // 保留id和sound参数
        const baseParams = filteredParams.filter(param =>
            param.key === 'id' || param.key === 'sound'
        );

        // 添加加密特有参数
        return [
            { key: 'iv', value: '***' },
            { key: 'ciphertext', value: '***' },
            ...baseParams
        ];
    }

    return filteredParams;
} 