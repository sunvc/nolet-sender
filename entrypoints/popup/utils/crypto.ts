import { EncryptionAlgorithm } from '../types';

/**
 * 生成指定长度的ASCII字符串
 * @param len 字符串长度
 * @returns 随机ASCII字符串
 */
export function generateAsciiString(len: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => charset[b % charset.length]).join('');
}

/**
 * 根据算法获取密钥长度
 * @param algorithm 加密算法
 * @returns 密钥长度（字节）
 */
export function getKeyLength(algorithm: EncryptionAlgorithm): number {
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
 * 生成密钥
 * @param algorithm 加密算法
 * @returns 随机密钥字符串
 */
export function generateKey(algorithm: EncryptionAlgorithm): string {
    const keyLength = getKeyLength(algorithm);
    return generateAsciiString(keyLength);
}

/**
 * 生成IV
 * @returns 16字节的随机IV字符串
 */
export function generateIV(): string {
    return generateAsciiString(16);
}

/**
 * 将UTF-8字符串转为Uint8Array
 */
function toUtf8Bytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * 将ArrayBuffer转base64字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
}

/**
 * AES-CBC加密，适用于浏览器环境（Web Crypto API）
 * @param plaintext 要加密的明文
 * @param keyStr 密钥字符串
 * @param ivStr IV字符串，必须为16字节
 * @returns 返回Base64编码的密文
 */
export async function encryptAESCBC(plaintext: string, keyStr: string, ivStr: string): Promise<string> {
    const keyBytes = toUtf8Bytes(keyStr);
    const iv = toUtf8Bytes(ivStr);
    const data = toUtf8Bytes(plaintext);

    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
    );

    // 加密
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