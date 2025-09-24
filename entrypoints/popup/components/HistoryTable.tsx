import React, { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ITextFilterParams, RowClassParams, RowClassRules, ValueFormatterParams } from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community'; // 主题
/* AG-Grid 更新很频繁，必要时需要查看历史版本文档
https://www.ag-grid.com/documentation-archive/ 
"ag-grid-community": "^34.2.0",
"ag-grid-react": "^34.2.0",*/
import {
    ModuleRegistry,
    ValidationModule,         // 开发验证
    LocaleModule,             // 本地化
    ClientSideRowModelModule, // Row Model 为 Client-Side
    DateFilterModule,         // 日期过滤器
    TextFilterModule,         // 文本过滤器
    // TooltipModule,
    // NumberFilterModule,
    QuickFilterModule,        // 快速过滤
    RowSelectionModule,       // 行选择
    RowStyleModule,           // 行样式
    GridApi,                  // 网格 API
    GridReadyEvent,           // 网格就绪事件
    ColDef,                   // 列定义
    ICellRendererParams       // 自定义单元格渲染
} from 'ag-grid-community';
import { Box, Card, Paper, TextField, useTheme } from '@mui/material';
import { HistoryRecord } from '../utils/database';
import { useTranslation } from 'react-i18next';
import {
    Search as SearchIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Help as HelpIcon,
    Undo as UndoIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

// 注册AG-Grid模块
ModuleRegistry.registerModules([
    // TooltipModule,
    TextFilterModule,
    // NumberFilterModule,
    DateFilterModule,
    QuickFilterModule,
    RowSelectionModule,
    LocaleModule,
    ClientSideRowModelModule,
    ValidationModule,
    RowStyleModule,
]);

// AG-Grid 本地化配置 (仅用到的部分, 已作删减, 完整版在 community-modules/locale/src)
const createAgGridLocale = (t: any) => ({
    // Number Filter & Text Filter
    filterOoo: t('history.table.filterOoo'), // 过滤...
    equals: t('history.table.equals'),       // 等于
    notEqual: t('history.table.notEqual'),   // 不等于
    blank: t('history.table.blank'),         // 空白
    notBlank: t('history.table.notBlank'),   // 非空
    empty: t('history.table.empty'),         // 空

    // // Number Filter
    // lessThan: '小于',
    // greaterThan: '大于',
    // lessThanOrEqual: '小于等于',
    // greaterThanOrEqual: '大于等于',
    inRange: t('history.table.inRange'),     // 介于
    // inRangeStart: '从',
    // inRangeEnd: '到',

    // Text Filter
    contains: t('history.table.contains'),   // 包含
    notContains: t('history.table.notContains'), // 不包含
    startsWith: t('history.table.startsWith'),   // 开始于
    endsWith: t('history.table.endsWith'),   // 结束于

    // // Date Filter
    dateFormatOoo: 'yyyy-mm-dd',
    before: t('history.table.before'),       // 之前
    after: t('history.table.after'),         // 之后      

    // Filter Conditions
    andCondition: t('history.table.andCondition'), // 且
    orCondition: t('history.table.orCondition'),  // 或

    // // Filter Buttons
    // applyFilter: '应用',
    resetFilter: t('history.table.resetFilter'),  // 重置
    // clearFilter: '清除',
    // cancelFilter: '取消',

    // Other
    loadingOoo: t('history.table.loadingOoo'),   // 加载中...
    // loadingError: '错误',
    // noRowsToShow: '无显示行',
    // enabled: '启用',

    // // ARIA 
    // // 以下为无障碍内容
    // ariaAdvancedFilterBuilderItem: '${variable}. 级别 ${variable}. 按 ENTER 进行编辑。',
    // ariaAdvancedFilterBuilderItemValidation: '${variable}. 级别 ${variable}. ${variable} 按 ENTER 进行编辑。',
    // ariaAdvancedFilterBuilderList: '高级过滤器构建器列表',
    // ariaAdvancedFilterBuilderFilterItem: '过滤条件',
    // ariaAdvancedFilterBuilderGroupItem: '过滤组',
    // ariaAdvancedFilterBuilderColumn: '列',
    // ariaAdvancedFilterBuilderOption: '选项',
    // ariaAdvancedFilterBuilderValueP: '值',
    // ariaAdvancedFilterBuilderJoinOperator: '连接运算符',
    // ariaAdvancedFilterInput: '高级过滤器输入',
    // ariaChecked: '已选中',
    // ariaColumn: '列',
    // ariaColumnGroup: '列组',
    ariaColumnFiltered: t('history.table.ariaColumnFiltered'), // 列已过滤
    // ariaColumnSelectAll: '切换所有列的可见性',
    // ariaDateFilterInput: '日期过滤器输入',
    // ariaDefaultListName: '列表',
    // ariaFilterColumnsInput: '过滤列输入',
    // ariaFilterFromValue: '过滤从值',
    // ariaFilterInput: '过滤器输入',
    // ariaFilterList: '过滤器列表',
    // ariaFilterToValue: '过滤至值',
    // ariaFilterValue: '过滤值',
    // ariaFilterMenuOpen: '打开过滤器菜单',
    // ariaFilteringOperator: '过滤运算符',
    // ariaHidden: '隐藏',
    // ariaIndeterminate: '不确定',
    // ariaInputEditor: '输入编辑器',
    // ariaMenuColumn: '按 ALT 向下 打开列菜单',
    ariaFilterColumn: '按 CTRL ENTER 打开过滤器', // 按 CTRL ENTER 打开过滤器
    ariaRowDeselect: '按 SPACE 取消选择此行', // 按 SPACE 取消选择此行
    // ariaHeaderSelection: '具有标题选择的列',
    // ariaSelectAllCells: '按空格键选择所有单元格',
    ariaRowSelectAll: '按 Space 切换所有行选择', // 按 Space 切换所有行选择
    ariaRowToggleSelection: '按 Space 切换行选择', // 按 Space 切换行选择
    ariaRowSelect: '按 SPACE 选择此行', // 按 SPACE 选择此行
    // ariaRowSelectionDisabled: '此行的行选择功能被禁用',
    // ariaSearch: '搜索',
    ariaSortableColumn: '按 ENTER 排序', // 按 ENTER 排序
    // ariaToggleVisibility: '按 Space 切换可见性',
    // ariaToggleCellValue: '按 Space 切换单元格值',
    // ariaUnchecked: '未选中',
    // ariaVisible: '可见',
    // ariaSearchFilterValues: '搜索过滤值',
    // ariaPageSizeSelectorLabel: '页面大小',
    // ariaChartMenuClose: '关闭图表编辑菜单',
    // ariaChartSelected: '已选择', // 已选择
    // ariaSkeletonCellLoadingFailed: '行加载失败',
    // ariaSkeletonCellLoading: '行数据加载中',
    // ariaDeferSkeletonCellLoading: '单元格正在加载',

    // // ARIA for Batch Edit
    // ariaPendingChange: '待处理的变更',

    // // ARIA Labels for Drop Zones
    // ariaRowGroupDropZonePanelLabel: '行分组',
    // ariaValuesDropZonePanelLabel: '值',
    // ariaPivotDropZonePanelLabel: '列标签',
    // ariaDropZoneColumnComponentDescription: '按 DELETE 键移除',
    // ariaDropZoneColumnValueItemDescription: '按 ENTER 键更改聚合类型',
    ariaDropZoneColumnGroupItemDescription: '按 ENTER 键排序', // 按 ENTER 键排序

    // // used for aggregate drop zone, format: {aggregation}{ariaDropZoneColumnComponentAggFuncSeparator}{column name}
    // ariaDropZoneColumnComponentAggFuncSeparator: ' 的 ',
    // ariaDropZoneColumnComponentSortAscending: '升序',
    // ariaDropZoneColumnComponentSortDescending: '降序',
    // ariaLabelDialog: '对话框',
    // ariaLabelColumnMenu: '列菜单',
    // ariaLabelColumnFilter: '列过滤器',
    // ariaLabelSelectField: '选择字段',

    // // Cell Editor
    // ariaValidationErrorPrefix: '单元格编辑器验证',
    // ariaLabelLoadingContextMenu: '正在加载上下文菜单',

    // // aria labels for rich select
    // ariaLabelRichSelectField: '丰富选择字段',
    // ariaLabelRichSelectToggleSelection: '按下空格键以切换选择',
    // ariaLabelRichSelectDeselectAllItems: '按下删除键来取消选择所有项目',
    // ariaLabelRichSelectDeleteSelection: '按下删除键来取消选择项目',
    // ariaLabelTooltip: '工具提示',
    // ariaLabelContextMenu: '上下文菜单',
    // ariaLabelSubMenu: '子菜单',
    // ariaLabelAggregationFunction: '聚合函数',
    // ariaLabelAdvancedFilterAutocomplete: '高级筛选自动完成',
    // ariaLabelAdvancedFilterBuilderAddField: '高级筛选生成器添加字段',
    // ariaLabelAdvancedFilterBuilderColumnSelectField: '高级筛选生成器列选择字段',
    // ariaLabelAdvancedFilterBuilderOptionSelectField: '高级筛选生成器选项选择字段',
    // ariaLabelAdvancedFilterBuilderJoinSelectField: '高级筛选生成器连接操作符选择字段',

    // // ARIA Labels for the Side Bar
    // ariaColumnPanelList: '列列表',
    // ariaFilterPanelList: '过滤列表',

    // // ARIA labels for new Filters Tool Panel
    // ariaLabelAddFilterField: '添加过滤字段',
    // ariaLabelFilterCardDelete: '删除过滤器',
    // ariaLabelFilterCardHasEdits: '有编辑',

    // // Number Format (Status Bar, Pagination Panel)
    // thousandSeparator: ',',
    // decimalSeparator: '.',

    // // Data types
    true: t('history.table.true'), // 是
    false: t('history.table.false'), // 否
    // invalidDate: '无效日期',
    // invalidNumber: '无效数字',
    // january: '一月',
    // february: '二月',
    // march: '三月',
    // april: '四月',
    // may: '五月',
    // june: '六月',
    // july: '七月',
    // august: '八月',
    // september: '九月',
    // october: '十月',
    // november: '十一月',
    // december: '十二月',

});

// 创建基于MUI主题的AG-Grid主题
const createAgGridTheme = (muiTheme: any) => {
    return themeQuartz.withParams({
        accentColor: muiTheme.palette.primary.main,
        backgroundColor: muiTheme.palette.background.paper,
        borderColor: muiTheme.palette.divider,
        borderRadius: 9,
        fontSize: 13,
        headerFontSize: 12,
        // browserColorScheme: muiTheme.palette.mode,
        // cellHorizontalPaddingScale: 0.7,
        chromeBackgroundColor: {
            ref: "backgroundColor"
        },
        // columnBorder: false,
        fontFamily: muiTheme.typography.fontFamily,
        // fontSize: muiTheme.typography.body2.fontSize,
        foregroundColor: muiTheme.palette.text.primary,
        headerBackgroundColor: muiTheme.palette.background.default,
        // headerFontSize: muiTheme.typography.caption.fontSize,
        // headerFontWeight: muiTheme.typography.fontWeightMedium,
        headerTextColor: muiTheme.palette.text.secondary,
        headerVerticalPaddingScale: 0.87, // 表头0.87倍行高
        // rowBorder: true,
        // rowVerticalPaddingScale: 0.8,
        // sidePanelBorder: true,
        spacing: '7.5px',
        wrapperBorder: true,
        wrapperBorderRadius: 14, // 表格整体圆角和主题的 Card 圆角一致
    });
};


interface HistoryTableProps {
    records: HistoryRecord[];
    selectedIds: number[];
    onSelectionChanged: (selectedIds: number[]) => void;
}

// 状态单元格渲染器
const StatusCellRenderer = (props: ICellRendererParams) => {
    const record = props.data as HistoryRecord;
    const { t } = useTranslation();
    const theme = useTheme();

    if (record.status === 'recalled') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: theme.palette.warning.main }}>{t('history.table.recalled')}</span>
                <UndoIcon sx={{ fontSize: '16px', color: theme.palette.warning.main }} />
            </div>
        );
    }
    if (record.responseJson.code === 200) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: theme.palette.success.main }}>{t('common.success')}</span>
                <CheckCircleIcon sx={{ fontSize: '16px', color: theme.palette.success.main }} />
            </div>
        );
    } else if (record.responseJson.code === -1) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: theme.palette.error.main }}>{t('common.failed')}</span>
                <ErrorIcon sx={{ fontSize: '16px', color: theme.palette.error.main }} />
            </div>
        );
    } else {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: theme.palette.warning.main }}>{t('common.other')}</span>
                <HelpIcon sx={{ fontSize: '16px', color: theme.palette.warning.main }} />
            </div>
        );
    }
};

// 加密状态单元格渲染器
const EncryptedCellRenderer = (props: ICellRendererParams) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const isEncrypted = props.value;

    return (
        <span style={{
            fontSize: '12px',
            color: isEncrypted ? '#4caf50' : theme.palette.text.disabled
        }}>
            {isEncrypted ? t('common.yes') : t('common.no')}
        </span>
    );
};

export default function HistoryTable({ records, selectedIds, onSelectionChanged }: HistoryTableProps) {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const gridApi = useRef<GridApi | null>(null);

    // 基于MUI主题创建AG-Grid主题
    const agGridTheme = useMemo(() => createAgGridTheme(theme), [theme]);

    // 创建AG-Grid本地化配置
    const agGridLocale = useMemo(() => createAgGridLocale(t), [t]);

    // 行样式规则
    const rowClassRules = useMemo<RowClassRules>(() => ({
        'ag-row-recalled': (params: RowClassParams<HistoryRecord>) => params.data?.status === 'recalled'
    }), []);

    // 列定义
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'createdAt',
            headerName: t('history.table.time'),
            sortable: true,
            filter: 'agDateColumnFilter',
            width: 105,
            // 将字符串转换为 Date 对象用于过滤器
            valueGetter: (params) => {
                // createdAt 是中文本地化格式字符串，如 '2024/09/19 14:30:25'，需要转换为 Date 对象
                if (params.data?.createdAt) {
                    return new Date(params.data.createdAt);
                }
                return null;
            },
            // 时间格式化显示
            valueFormatter: (params: ValueFormatterParams) => {
                // 如果 params.value 是 Date 对象，直接使用；否则从原始数据解析
                let date = params.value;
                if (!(date instanceof Date) && params.data?.createdAt) {
                    date = new Date(params.data.createdAt);
                }
                return dayjs(date).format('HH:mm:ss');
            },
            filterParams: {
                buttons: ["reset"],
                closeOnApply: true,
                // 自定义日期比较器，确保比较的是 Date 对象
                comparator: (filterLocalDateAtMidnight: Date, cellValue: any) => {
                    if (!cellValue) return -1;

                    // 确保 cellValue 是 Date 对象
                    let cellDate = cellValue;
                    if (!(cellValue instanceof Date)) {
                        // 如果不是 Date 对象，尝试解析
                        if (typeof cellValue === 'string') {
                            cellDate = new Date(cellValue);
                        } else {
                            return -1;
                        }
                    }

                    // 比较日期（只比较日期部分，不包括时间）
                    const cellDateAtMidnight = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

                    if (cellDateAtMidnight < filterLocalDateAtMidnight) return -1;
                    if (cellDateAtMidnight > filterLocalDateAtMidnight) return 1;
                    return 0;
                }
            }
        },
        {
            field: 'body',
            headerName: t('history.table.content'),
            sortable: true,
            filter: 'agTextColumnFilter',
            minWidth: 150,
            flex: 1,
            // tooltipField: 'body',
        },
        {
            field: 'title',
            headerName: t('history.table.title'),
            sortable: true,
            filter: 'agTextColumnFilter',
            width: 150,
            // tooltipField: 'title'
        },
        {
            field: 'deviceName',
            headerName: t('history.table.device'),
            sortable: true,
            filter: 'agTextColumnFilter',
            width: 150,
            // tooltipField: 'deviceName'
        },
        {
            field: 'status',
            headerName: t('history.table.status'),
            width: 128,
            cellRenderer: StatusCellRenderer,
            sortable: true,
            filter: 'agTextColumnFilter',
            filterParams: {
                buttons: ["reset"],
                closeOnApply: true,
                // 自定义过滤器选项，包含所有可能的状态值
                filterOptions: [
                    'empty', // 显示为 选择一个 
                    {
                        displayKey: 'isSuccess',
                        displayName: t('common.success'), // 成功
                        predicate: ([], cellValue: any) => {
                            // 检查是否为成功状态 (responseJson.code === 200 且不是已撤回)
                            const record = cellValue as HistoryRecord;
                            return record && record.status !== 'recalled' && record.responseJson?.code === 200;
                        },
                        numberOfInputs: 0
                    },
                    {
                        displayKey: 'isFailed',
                        displayName: t('common.failed'), // 失败
                        predicate: ([], cellValue: any) => {
                            // 检查是否为失败状态 (responseJson.code === -1 且不是已撤回)
                            const record = cellValue as HistoryRecord;
                            return record && record.status !== 'recalled' && record.responseJson?.code === -1;
                        },
                        numberOfInputs: 0
                    },
                    {
                        displayKey: 'isRecalled',
                        displayName: t('history.table.recalled'), // 已撤回
                        predicate: ([], cellValue: any) => {
                            // 检查是否为已撤回状态
                            const record = cellValue as HistoryRecord;
                            return record && record.status === 'recalled';
                        },
                        numberOfInputs: 0
                    },
                    {
                        displayKey: 'isOther',
                        displayName: t('common.other'), // 其他
                        predicate: ([], cellValue: any) => {
                            // 检查是否为其他状态 (不是200也不是-1，且不是已撤回)
                            const record = cellValue as HistoryRecord;
                            return record && record.status !== 'recalled' &&
                                record.responseJson?.code !== 200 &&
                                record.responseJson?.code !== -1;
                        },
                        numberOfInputs: 0
                    }
                ]
            },
            // 为过滤器提供完整的记录对象而不是字段值
            valueGetter: (params) => {
                return params.data; // 返回整个记录对象供 predicate 函数使用
            }
        },
        {
            field: 'isEncrypted',
            headerName: t('history.table.encrypted'),
            width: 128,
            cellRenderer: EncryptedCellRenderer,
            sortable: true,
            filter: 'agTextColumnFilter',
            filterParams: {
                buttons: ["reset",],
                closeOnApply: true,
                // 自定义过滤器选项，包含所有可能的加密状态值
                filterOptions: [
                    'empty',
                    {
                        displayKey: 'isEncrypted',
                        displayName: t('common.yes'), // 是（已加密）
                        predicate: ([], cellValue: any) => {
                            return cellValue === true;
                        },
                        numberOfInputs: 0
                    },
                    {
                        displayKey: 'isNotEncrypted',
                        displayName: t('common.no'), // 否（未加密）
                        predicate: ([], cellValue: any) => {
                            return cellValue === false;
                        },
                        numberOfInputs: 0
                    }
                ]
            }
        }
    ], [t]);

    // 默认列配置
    const defaultColDef = useMemo(() => ({
        resizable: true,
        filterParams: {
            buttons: ["reset",],
            closeOnApply: true,
        } as ITextFilterParams,
    }), []);

    // 表格就绪事件处理
    const onGridReady = useCallback((params: GridReadyEvent) => {
        gridApi.current = params.api;
        // 设置初始选中状态
        if (selectedIds.length > 0) {
            const selectedNodes = selectedIds.map(id =>
                params.api.getRowNode(id.toString())
            ).filter(node => node !== null);
            selectedNodes.forEach(node => node?.setSelected(true));
        }
    }, [selectedIds, i18n.language]); // 添加语言依赖，确保语言切换后选中状态正确

    // 选择变更事件处理
    const onSelectionChangedHandler = useCallback(() => {
        if (!gridApi.current) return;
        const selectedRows = gridApi.current.getSelectedRows();
        const newSelectedIds = selectedRows.map(row => row.id);
        onSelectionChanged(newSelectedIds);
    }, [onSelectionChanged]);

    const [quickFilterText, setQuickFilterText] = useState('');

    const selectionColumnDef = useMemo(() => { // https://www.ag-grid.com/react-data-grid/row-selection-multi-row/#customising-the-checkbox-column
        return {
            // sortable: false,
            // resizable: false,
            // suppressHeaderMenuButton: false,
            width: 45,
            pinned: 'left' as const,
        };
    }, []);

    const [isComposing, setIsComposing] = useState(false);
    return (
        <>
            <Box sx={{ border: 'none', boxShadow: 'lg', pb: isComposing ? 1.5 : 0 }}>
                <TextField
                    sx={{ width: '100%', pt: 1, pb: 1.5, }}
                    size="small"
                    // id="filter-text-box"
                    placeholder={t('history.toolbar.search_placeholder')}
                    onInput={(e) => setQuickFilterText((e.target as HTMLInputElement).value)}
                    autoFocus
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    slotProps={{
                        input: {
                            startAdornment: <SearchIcon sx={{ mr: 1 }} fontSize="small" />,
                            // endAdornment: <IconButton onClick={() => { // 刷新按钮
                            //     gridApi.current?.setFilterModel(null); // 清除所有筛选
                            //     gridApi.current?.onFilterChanged(); // 通知 grid 重新过滤
                            // }}>
                            //     <RefreshIcon fontSize="small" />
                            // </IconButton>
                        }
                    }}
                />
            </Box>
            <Paper sx={{
                height: 'calc(100% - 60px - ' + (isComposing ? '12' : '0') + 'px)',
                position: 'relative',
                width: '100%',
                '& .ag-checkbox-input-wrapper': {
                    borderRadius: '4.5px !important'
                },
                '& .ag-picker-field-wrapper': {
                    borderRadius: '9px !important'
                },
                '& .ag-filter-apply-panel-button': {
                    width: '100% !important',
                    padding: '2px !important',
                    margin: '0px !important'
                },
                '& .ag-cell': {
                    paddingRight: '0px !important'
                },
                border: 'none',
                // boxShadow: 'lg'
            }}>
                <AgGridReact
                    key={`ag-grid-${i18n.language}`} // 强制在语言切换时重新渲染
                    rowData={records}

                    suppressMovableColumns={true}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection={{
                        mode: "multiRow",
                        enableClickSelection: true, // 启用点击行选中
                        enableSelectionWithoutKeys: true, // 启用点击行选中
                        selectAll: 'filtered',
                        checkboxes: true,
                        // headerCheckbox: false
                    }}
                    scrollbarWidth={11} // hack: 这个版本的 ag-grid 在 dev 环境下渲染导致 popup 宽度问题, 虽然生产环境其实并不需要, 加上无所谓
                    suppressContextMenu // 阻止右键菜单
                    theme={agGridTheme}
                    loading={false}
                    localeText={agGridLocale}
                    onGridReady={onGridReady}
                    onSelectionChanged={onSelectionChangedHandler}
                    getRowId={params => params.data.id.toString()}
                    rowClassRules={rowClassRules}
                    animateRows
                    quickFilterText={quickFilterText}
                    selectionColumnDef={selectionColumnDef}
                // suppressHorizontalScroll={true}
                />
            </Paper>
        </>
    );
}
