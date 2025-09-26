import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// 历史记录接口
export interface HistoryRecord {
    id?: number; // 自增ID, 前端渲染使用
    uuid: string; // 唯一标识符, 用于去重
    timestamp: number; // 唯一时间戳, 用作 key (结合 uuid 在导入时实现去重排序)
    body: string; // 推送内容
    apiUrl: string; // 请求的API URL
    deviceName: string; // 设备名称
    parameters: any[]; // 完整的参数数组
    responseJson: any; // 响应的JSON内容
    requestTimestamp: number; // 请求时间戳
    responseTimestamp: number; // 响应时间戳
    timezone: string; // 请求时用户的时区
    method: 'GET' | 'POST'; // 请求方法
    title?: string; // 推送标题（可选）
    sound?: string; // 铃声（可选）
    url?: string; // 链接（可选）
    isEncrypted: boolean; // 是否加密
    createdAt: string; // 创建时间字符串 YYYY-MM-DD HH:mm:ss
    status?: string | null; // 状态标记: null=正常, 'recalled'=已撤回
    authorization?: {
        type: 'basic'; // 认证类型
        user: string; // 用户名 (用于显示)
        pwd: string; // 密码 (用于显示)
        value: string; // Basic <凭证> (用于请求)
    }; // Basic Auth (可选)
    inspectType?: string; // 推送类型
}

// 数据库结构定义
interface BarkDB extends DBSchema {
    history: {
        key: number;
        value: HistoryRecord;
        indexes: {
            'by-timestamp': number;
            'by-uuid': string;
        };
    };
}

class DatabaseManager {
    private db: IDBPDatabase<BarkDB> | null = null;
    private readonly DB_NAME = 'BarkSenderDB';
    private readonly DB_VERSION = 1;

    // 初始化数据库
    async init(): Promise<void> {
        if (this.db) return;

        this.db = await openDB<BarkDB>(this.DB_NAME, this.DB_VERSION, {
            upgrade(db) {
                // 创建历史记录表
                const historyStore = db.createObjectStore('history', {
                    keyPath: 'id',
                    autoIncrement: true,
                });

                // 创建索引
                historyStore.createIndex('by-timestamp', 'timestamp', { unique: true });
                historyStore.createIndex('by-uuid', 'uuid', { unique: true });
            },
        });
    }

    // 添加历史记录
    async addRecord(record: Omit<HistoryRecord, 'id' | 'timestamp' | 'createdAt'> & { uuid?: string }): Promise<HistoryRecord> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        const now = Date.now();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const createdAt = new Date(now).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });

        const fullRecord: HistoryRecord = {
            ...record,
            uuid: record.uuid,
            timestamp: now,
            timezone,
            createdAt,
        };

        try {
            const id = await this.db.add('history', fullRecord);
            return { ...fullRecord, id };
        } catch (error) {
            // 如果是唯一性约束错误, 生成新的时间戳
            if (error instanceof Error && error.name === 'ConstraintError') {
                // 递增时间戳直到找到唯一值
                let uniqueTimestamp = now + 1;
                while (true) {
                    try {
                        const retryRecord = {
                            ...fullRecord,
                            timestamp: uniqueTimestamp,
                        };
                        const id = await this.db.add('history', retryRecord);
                        return { ...retryRecord, id };
                    } catch (retryError) {
                        if (retryError instanceof Error && retryError.name === 'ConstraintError') {
                            uniqueTimestamp++;
                            continue;
                        }
                        throw retryError;
                    }
                }
            }
            throw error;
        }
    }

    // 获取所有历史记录, 按时间倒序排列
    async getAllRecords(): Promise<HistoryRecord[]> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        const records = await this.db.getAll('history');
        return records.sort((a, b) => b.timestamp - a.timestamp);
    }

    // 根据 ID 数组批量删除记录
    async deleteRecords(ids: number[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        const tx = this.db.transaction('history', 'readwrite');
        const promises = ids.map(id => tx.store.delete(id));
        await Promise.all(promises);
        await tx.done;
    }

    // 根据 UUID 查询对应记录
    async getRecordByUuid(uuid: string): Promise<HistoryRecord | null> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        try {
            const record = await this.db.getFromIndex('history', 'by-uuid', uuid);
            return record || null;
        } catch (error) {
            console.error('根据UUID查询记录失败:', error);
            return null;
        }
    }

    // 根据UUID更新记录状态
    async updateRecordStatus(uuid: string, status: string | null): Promise<boolean> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        try {
            // 先通过UUID查询记录
            const record = await this.db.getFromIndex('history', 'by-uuid', uuid);
            if (!record) {
                console.error('未找到UUID对应的记录:', uuid);
                return false;
            }

            // 更新状态
            const updatedRecord = { ...record, status };

            // 保存更新后的记录
            await this.db.put('history', updatedRecord);
            // console.debug('成功更新记录状态:', uuid, status);
            return true;
        } catch (error) {
            console.error('更新记录状态失败:', error);
            return false;
        }
    }

    // 导出所有记录
    async exportRecords(): Promise<HistoryRecord[]> {
        return await this.getAllRecords();
    }

    // 导入记录（可去重）
    async importRecords(records: HistoryRecord[]): Promise<{ success: number; skipped: number; errors: number }> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        let success = 0;
        let skipped = 0;
        let errors = 0;

        for (const record of records) {
            try {
                // 检查 UUID 是否已存在
                const existing = await this.db.getFromIndex('history', 'by-uuid', record.uuid);
                if (existing) {
                    skipped++;
                    continue;
                }

                // 检查时间戳是否已存在
                const existingByTimestamp = await this.db.getFromIndex('history', 'by-timestamp', record.timestamp);
                if (existingByTimestamp) {
                    // 如果时间戳冲突但 UUID 不同, 调整时间戳
                    let newTimestamp = record.timestamp;
                    while (await this.db.getFromIndex('history', 'by-timestamp', newTimestamp)) {
                        newTimestamp++;
                    }
                    record.timestamp = newTimestamp;
                }

                // 移除id字段, 让数据库自动生成
                const { id, ...recordWithoutId } = record;
                await this.db.add('history', recordWithoutId);
                success++;
            } catch (error) {
                console.error('导入记录失败:', error, record);
                errors++;
            }
        }

        return { success, skipped, errors };
    }

    // 清空所有记录
    async clearAllRecords(): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('数据库未初始化');

        await this.db.clear('history');
    }

    // 根据关键字搜索记录
    async searchRecords(keyword: string): Promise<HistoryRecord[]> {
        const allRecords = await this.getAllRecords();
        const lowerKeyword = keyword.toLowerCase();

        return allRecords.filter(record => {
            return (
                record.body.toLowerCase().includes(lowerKeyword) ||
                record.deviceName.toLowerCase().includes(lowerKeyword) ||
                (record.title && record.title.toLowerCase().includes(lowerKeyword)) ||
                record.apiUrl.toLowerCase().includes(lowerKeyword)
            );
        });
    }
}

// 导出单例实例
export const dbManager = new DatabaseManager();

// 根据 UUID 查询历史记录
export async function getHistoryRecordByUuid(uuid: string): Promise<HistoryRecord | null> {
    return await dbManager.getRecordByUuid(uuid);
}

// 根据UUID更新历史记录状态
export async function updateHistoryRecordStatus(uuid: string, status: string | null): Promise<boolean> {
    return await dbManager.updateRecordStatus(uuid, status);
}

// 记录推送历史
export async function recordPushHistory(
    body: string,
    apiUrl: string,
    deviceName: string,
    response: any,
    method: 'GET' | 'POST' = 'GET',
    options: {
        title?: string;
        sound?: string;
        url?: string;
        isEncrypted?: boolean;
        parameters?: any[];
        uuid?: string;
        authorization?: {
            type: 'basic';
            user: string;
            pwd: string;
            value: string;
        };
    } = {}
): Promise<HistoryRecord> {
    const requestTimestamp = Date.now();
    const responseTimestamp = Date.now();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return await dbManager.addRecord({
        uuid: options.uuid || uuidv4(),
        body,
        apiUrl,
        deviceName,
        parameters: options.parameters || [],
        responseJson: response,
        requestTimestamp,
        responseTimestamp,
        timezone,
        method,
        title: options.title,
        sound: options.sound,
        url: options.url,
        isEncrypted: options.isEncrypted || false,
        authorization: options.authorization,
    });
}
