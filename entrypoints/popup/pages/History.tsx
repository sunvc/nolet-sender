import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Stack,
    Button,
    Checkbox,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    useTheme,
    InputAdornment
} from '@mui/material';
import LottiePlayer from '../components/LottiePlayer';
import {
    Delete as DeleteIcon,
    Download as DownloadIcon,
    Upload as UploadIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Help as HelpIcon,
    NavigateBefore as NavigateBeforeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { HistoryRecord, dbManager } from '../utils/database';

export default function History() {
    const { t } = useTranslation();
    const theme = useTheme();
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [hasData, setHasData] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasInitialized = useRef(false); // 防止重复初始化
    const importLock = useRef(false); // 导入锁，防止重复导入

    // 分页相关状态
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10); // 每页显示10条记录
    const [pageInputValue, setPageInputValue] = useState('1');
    const [allRecords, setAllRecords] = useState<HistoryRecord[]>([]);

    // 导入 storage.local 中的暂存历史记录到IndexedDB
    const importStorageHistory = async () => {
        // 检查导入锁
        if (importLock.current) {
            console.debug('导入操作正在进行中，跳过重复导入');
            return;
        }

        try {
            importLock.current = true; // 加锁
            console.debug('开始导入 storage.local 中的暂存历史记录');

            // 1. 从 storage.local读取暂存历史记录
            const result = await browser.storage.local.get('bark_history');
            const storageHistory = result.bark_history || [];

            if (storageHistory.length === 0) {
                console.debug('没有需要导入的暂存历史记录');
                return;
            }

            console.debug(`发现 ${storageHistory.length} 条暂存历史记录，准备导入`);

            // 2. 深拷贝暂存数据
            const historyToImport = JSON.parse(JSON.stringify(storageHistory));

            // 3. 删除 storage.local中的暂存数据
            await browser.storage.local.remove('bark_history');
            console.debug('已清除 storage.local 中的暂存历史记录');

            // 4. 将深拷贝的数据导入到IndexedDB
            let importedCount = 0;
            for (const record of historyToImport) {
                try {
                    // 检查是否已存在相同UUID的记录
                    const existingRecords = await dbManager.getAllRecords();
                    const exists = existingRecords.some(existing => existing.uuid === record.uuid);

                    if (!exists) {
                        // 移除id字段，让数据库自动生成
                        const { id, ...recordWithoutId } = record;
                        await dbManager.addRecord(recordWithoutId);
                        importedCount++;
                    }
                } catch (error) {
                    console.error('导入单条记录失败:', error, record);
                }
            }

            console.debug(`成功导入 ${importedCount} 条历史记录到IndexedDB`);

        } catch (error) {
            console.error('导入暂存历史记录失败:', error);
        } finally {
            importLock.current = false; // 释放锁
        }
    };

    // 加载历史记录, 因为 background 记录到 IndexedDB 中困难，所以暂存 storage.local 读取历史记录
    const loadRecords = async (forceReload: boolean = false) => {
        // 防止重复调用（除非强制刷新）
        if (hasInitialized.current && !forceReload) {
            console.debug('loadRecords 已经初始化过，跳过重复调用');
            return;
        }

        try {
            setLoading(true);
            if (!forceReload) {
                hasInitialized.current = true; // 标记已初始化
            }

            // 从 storage.local 读取历史记录
            const result = await browser.storage.local.get('bark_history');
            const storageHistory = result.bark_history || [];

            console.debug('从 storage.local读取的历史记录:', storageHistory);
            console.debug('历史记录数量:', storageHistory.length);

            // 如果有暂存的历史记录，自动导入到IndexedDB
            if (storageHistory.length > 0) {
                await importStorageHistory();
            }

            // 从IndexedDB读取历史记录用于显示
            const data = await dbManager.getAllRecords();
            setAllRecords(data); // 保存所有记录
            setHasData(data.length > 0);
            setTotalPages(Math.max(1, Math.ceil(data.length / pageSize)));

            // 更新当前页显示的记录
            const startIndex = (currentPage - 1) * pageSize;
            setRecords(data.slice(startIndex, startIndex + pageSize));
        } catch (error) {
            console.error('加载历史记录失败:', error);
            setAlert({ type: 'error', message: t('history.messages.load_failed') }); // 加载历史记录失败
        } finally {
            setLoading(false);
        }
    };

    // 搜索记录
    const searchRecords = async () => {
        if (!searchKeyword.trim()) {
            await loadRecords(true); // 强制刷新
            return;
        }

        try {
            setLoading(true);
            const data = await dbManager.searchRecords(searchKeyword.trim());
            setAllRecords(data);
            setTotalPages(Math.max(1, Math.ceil(data.length / pageSize)));
            setCurrentPage(1);
            setPageInputValue('1');
            setRecords(data.slice(0, pageSize));
        } catch (error) {
            console.error('搜索失败:', error);
            setAlert({ type: 'error', message: t('common.error_unknown') }); // 搜索失败显示未知错误
        } finally {
            setLoading(false);
        }
    };

    // 批量删除记录
    const handleDelete = async () => {
        if (selectedIds.length === 0) return;

        try {
            setDeleting(true);
            await dbManager.deleteRecords(selectedIds);
            setSelectedIds([]);
            setShowDeleteDialog(false);
            await loadRecords(true);
            setAlert({ type: 'success', message: t('history.messages.delete_success', { count: selectedIds.length }) }); // 已删除 {{count}} 条记录
        } catch (error) {
            console.error('删除失败:', error);
            setAlert({ type: 'error', message: t('history.messages.delete_failed') }); // 删除失败
        } finally {
            setDeleting(false);
        }
    };

    // 导出记录
    const handleExport = async () => {
        try {
            const data = await dbManager.exportRecords();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bark-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setAlert({ type: 'success', message: t('history.messages.export_success') });
        } catch (error) {
            console.error('导出失败:', error);
            setAlert({ type: 'error', message: t('history.messages.export_failed') });
        }
    };

    // 导入记录
    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text) as HistoryRecord[];

            if (!Array.isArray(data)) {
                throw new Error('无效的文件格式');
            }

            const result = await dbManager.importRecords(data);
            await loadRecords(true);
            setAlert({
                type: 'success',
                message: t('history.messages.import_success_message', { success: result.success, skipped: result.skipped, errors: result.errors }) // 导入完成：成功 {{success}} 条，跳过 {{skipped}} 条，失败 {{errors}} 条
            });
        } catch (error) {
            console.error('导入失败:', error);
            setAlert({ type: 'error', message: t('history.messages.import_failed', { message: error instanceof Error ? error.message : t('common.error_unknown') }) }); // 导入失败
        }

        // 重置文件输入
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 全选/取消全选
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(records.map(r => r.id!).filter(id => id !== undefined));
        } else {
            setSelectedIds([]);
        }
    };

    // 单选切换
    const handleSelectRecord = (id: number, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
        }
    };

    // 格式化响应状态
    const getStatusDisplay = (record: HistoryRecord) => {
        if (record.responseJson.code === 200) {
            return {
                icon: <CheckCircleIcon sx={{ fontSize: '16px', color: '#4caf50' }} />,
                color: '#4caf50',
                title: t('common.success')
            };
        } else if (record.responseJson.code === -1) {
            return {
                icon: <ErrorIcon sx={{ fontSize: '16px', color: '#f44336' }} />,
                color: '#f44336',
                title: t('common.failed')
            };
        } else {
            return {
                icon: <HelpIcon sx={{ fontSize: '16px', color: '#ff9800' }} />,
                color: '#ff9800',
                title: t('common.other')
            };
        }
    };

    // 截取长文本
    const truncateText = (text: string, maxLength: number = 30) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // 处理页码变化
    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;

        setCurrentPage(newPage);
        setPageInputValue(newPage.toString());
        const startIndex = (newPage - 1) * pageSize;
        setRecords(allRecords.slice(startIndex, startIndex + pageSize));
    };

    // 处理页码输入
    const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPageInputValue(value);

        const pageNum = parseInt(value);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            handlePageChange(pageNum);
        }
    };

    // 处理页码输入框失焦
    const handlePageInputBlur = () => {
        const pageNum = parseInt(pageInputValue);
        if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
            setPageInputValue(currentPage.toString());
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    if (loading && !hasData) {
        return (
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 操作栏 */}
            <Stack spacing={1} sx={{ mb: 2 }}>
                {/* 搜索相关 */}
                <Stack direction="row" spacing={1} alignItems="center"
                    sx={{ pointerEvents: !hasData && searchKeyword.trim() === '' ? 'none' : 'auto', opacity: !hasData && searchKeyword.trim() === '' ? 0.5 : 1 }}>
                    <TextField
                        size="small"
                        placeholder={t('history.toolbar.search_placeholder')} // 搜索消息内容、设备名称...
                        value={searchKeyword}
                        onChange={(e) => {
                            const newValue = e.target.value;
                            setSearchKeyword(newValue);
                            // 当搜索框清空时，自动恢复原始历史记录
                            if (!newValue.trim()) {
                                console.debug('搜索框清空，自动恢复原始历史记录');
                                loadRecords(true);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                searchRecords();
                            }
                        }}
                        sx={{ flex: 1 }}
                    />
                    {/* 搜索 */}
                    <IconButton
                        onClick={searchRecords}
                        color="primary"
                        size="small"
                        disabled={!hasData || searchKeyword.trim() === ''}
                        aria-label={t('history.toolbar.search')}
                    >
                        <SearchIcon />
                    </IconButton>
                    {/* 清除搜索 */}
                    <IconButton
                        onClick={() => {
                            setSearchKeyword('');
                            loadRecords(true);
                        }}
                        disabled={searchKeyword.trim() === ''}
                        size="small"
                        aria-label={t('history.toolbar.clear_search')}
                    >
                        <ClearIcon />
                    </IconButton>
                </Stack>

                {/* 操作按钮 */}
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={t('history.refresh')}>
                            <span>
                                <IconButton onClick={() => loadRecords(true)} color="primary" size="small">
                                    <RefreshIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={t('history.export')}>
                            <span>
                                <IconButton
                                    onClick={handleExport}
                                    color="primary"
                                    size="small"
                                    disabled={!hasData}
                                >
                                    <DownloadIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={t('history.import')}>
                            <IconButton
                                color="primary"
                                size="small"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <UploadIcon />
                            </IconButton>
                        </Tooltip>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            style={{ display: 'none' }}
                        />
                    </Stack>

                    {selectedIds.length > 0 && (
                        <Button
                            variant="text"
                            color="error"
                            size="small"
                            startIcon={<DeleteIcon />}
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            {t('history.toolbar.delete_selected')} ({selectedIds.length})
                        </Button>
                    )}
                </Stack>
            </Stack>

            {/* 警告信息 */}
            {alert && (
                <Alert
                    severity={alert.type}
                    onClose={() => setAlert(null)}
                    sx={{ mb: 2 }}
                >
                    {alert.message}
                </Alert>
            )}

            {/* 记录表格 */}
            {!hasData && searchKeyword.trim() === '' ?
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
                        <LottiePlayer
                            autoplay
                            loop
                            src="/lottie/coming-soon.json"
                            style={{ height: '180px', width: '180px' }}
                        />
                        <Typography variant="h6" color="text.secondary">
                            {/* 空 */}
                            {t('history.messages.empty')}
                        </Typography>
                    </Stack>
                </Box>
                :
                <>
                    <Stack direction="row" gap={1} alignItems="flex-end" justifyContent="space-between" sx={{ mb: 1, mt: 0 }}>
                        {/* 记录统计 */}
                        < Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {t('history.table.records_count', { count: records.length })}
                            {selectedIds.length > 0 && ` (${t('history.table.selected_count', { count: selectedIds.length })})`}
                        </Typography>

                        {/* 分页控制 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                            <Tooltip title={t('common.previous_page')} placement="top" arrow>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage <= 1 || !hasData}
                                    >
                                        <NavigateBeforeIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <TextField
                                size="small"
                                value={pageInputValue}
                                onChange={handlePageInputChange}
                                onBlur={handlePageInputBlur}
                                sx={{
                                    width: '60px',
                                    '& input': {
                                        padding: '4px 8px',
                                        textAlign: 'center'
                                    }
                                }}
                                aria-label={t('common.page')}
                                InputProps={{
                                    endAdornment: <InputAdornment position="end">/{totalPages}</InputAdornment>,
                                }}
                                disabled={!hasData}
                            />

                            <Tooltip title={t('common.next_page')} placement="top" arrow>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage >= totalPages || !hasData}
                                    >
                                        <NavigateNextIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Box>
                    </Stack>
                    <Box
                        sx={{
                            flex: 1,
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: 1,
                            borderColor: 'divider',
                            bgcolor: 'background.paper'
                        }}
                    >
                        <Box
                            sx={{
                                height: '100%',
                                overflow: 'auto',
                                bgcolor: 'background.paper'
                            }}
                        >
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '14px',
                                backgroundColor: 'transparent'
                            }}>
                                <thead>
                                    <tr style={{
                                        backgroundColor: theme.palette.background.paper,
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 1
                                    }}>
                                        <th style={{
                                            padding: '8px 4px',
                                            textAlign: 'center',
                                            width: '40px',
                                            backgroundColor: theme.palette.background.paper
                                        }}>
                                            <Checkbox
                                                size="small"
                                                checked={records.length > 0 && selectedIds.length === records.length}
                                                indeterminate={selectedIds.length > 0 && selectedIds.length < records.length}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        {/* 时间 */}
                                        <th style={{
                                            padding: '8px',
                                            textAlign: 'left',
                                            width: '120px',
                                            backgroundColor: theme.palette.background.paper,
                                            color: theme.palette.text.primary
                                        }}>{t('history.table.time')}</th>
                                        {/* 消息 */}
                                        <th style={{
                                            padding: '8px',
                                            textAlign: 'left',
                                            minWidth: '200px',
                                            backgroundColor: theme.palette.background.paper,
                                            color: theme.palette.text.primary
                                        }}>{t('history.table.content')}</th>
                                        {/* 设备 */}
                                        <th style={{
                                            padding: '8px',
                                            textAlign: 'left',
                                            width: '100px',
                                            backgroundColor: theme.palette.background.paper,
                                            color: theme.palette.text.primary
                                        }}>{t('history.table.device')}</th>
                                        {/* 状态 */}
                                        <th style={{
                                            padding: '8px',
                                            textAlign: 'center',
                                            width: '60px',
                                            backgroundColor: theme.palette.background.paper,
                                            color: theme.palette.text.primary
                                        }}>{t('history.table.status')}</th>
                                        {/* 加密 */}
                                        <th style={{
                                            padding: '8px',
                                            textAlign: 'center',
                                            width: '60px',
                                            backgroundColor: theme.palette.background.paper,
                                            color: theme.palette.text.primary
                                        }}>{t('history.table.encrypted')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{
                                                padding: '40px',
                                                textAlign: 'center',
                                                color: theme.palette.text.secondary
                                            }}>
                                                {searchKeyword ? t('history.messages.no_search_results') : t('history.messages.empty')}
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((record) => {
                                            const status = getStatusDisplay(record);
                                            const isSelected = selectedIds.includes(record.id!);

                                            return (
                                                <tr
                                                    key={record.id}
                                                    style={{
                                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                                        backgroundColor: isSelected ? theme.palette.action.selected : 'transparent'
                                                    }}
                                                >
                                                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                                        <Checkbox
                                                            size="small"
                                                            checked={isSelected}
                                                            onChange={(e) => handleSelectRecord(record.id!, e.target.checked)}
                                                        />
                                                    </td>
                                                    <td style={{
                                                        padding: '8px',
                                                        fontSize: '12px',
                                                        color: theme.palette.text.secondary
                                                    }}>
                                                        {record.createdAt}
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <div style={{ fontWeight: 500 }}>
                                                            {record.title && (
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    color: theme.palette.text.secondary,
                                                                    marginBottom: '2px'
                                                                }}>
                                                                    {t('history.table.title_prefix')}: {truncateText(record.title)}
                                                                </div>
                                                            )}
                                                            <div title={record.body} style={{
                                                                color: theme.palette.text.primary
                                                            }}>
                                                                {truncateText(record.body, 50)}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <div style={{
                                                            fontSize: '13px',
                                                            fontWeight: 500,
                                                            color: theme.palette.text.primary
                                                        }}>
                                                            {record.deviceName}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            <span style={{
                                                                fontSize: '12px',
                                                                color: status.color,
                                                                fontWeight: 500
                                                            }}>
                                                                {status.title}
                                                            </span>
                                                            <span>
                                                                {status.icon}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                                        <span style={{
                                                            fontSize: '12px',
                                                            color: record.isEncrypted ? '#4caf50' : theme.palette.text.disabled
                                                        }}>
                                                            {record.isEncrypted ? t('common.yes') : t('common.no')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </Box>
                    </Box>
                </>
            }

            {/* 删除确认对话框 */}
            <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
                {/* 确认删除 */}
                <DialogTitle>{t('history.confirm_delete')}</DialogTitle>
                {/* 确定要删除选中的 {{count}} 条记录吗？此操作不可撤销。 */}
                <DialogContent>
                    {t('history.confirm_delete_message', { count: selectedIds.length })}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeleteDialog(false)}>取消</Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
                    >
                        {deleting ? t('common.processing') : t('common.delete')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
} 