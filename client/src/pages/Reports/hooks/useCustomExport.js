import { useState, useEffect, useMemo, useCallback } from 'react';
import ExportService from '../../../services/exportService';
import { useToast } from '../../../components/ui/Toast';
import {
  buildSmartReportTitle,
  compileReportFilters,
} from '../exportConfig';

export function useCustomExport() {
  const toast = useToast();

  // Active Report Type
  const [reportType, setReportType] = useState('nominal');

  // Filter Options Catalog (loaded from server)
  const [filterOptions, setFilterOptions] = useState({
    provinces: [],
    directorates: {},
    employmentCategories: [],
    ranks: [],
    leaveTypes: [],
    specialCaseTypes: [],
  });
  const [isOptionsLoading, setIsOptionsLoading] = useState(true);

  // Selected Cascading Filters
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDirectorate, setSelectedDirectorate] = useState('');

  // Template-Specific Filters
  const [employmentCategory, setEmploymentCategory] = useState('');
  const [rankId, setRankId] = useState('');
  const [status, setStatus] = useState('');
  const [gender, setGender] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Leaves Filters
  const [leaveType, setLeaveType] = useState('');
  const [resumeStatus, setResumeStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Special Cases Filters
  const [caseType, setCaseType] = useState('');
  const [activeStatus, setActiveStatus] = useState('');

  // Degrees / Experience Mode
  const [categoryMode, setCategoryMode] = useState('all');

  // Custom Report Title
  const [customTitle, setCustomTitle] = useState('');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);

  // Column Picker State
  const [availableColumns, setAvailableColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);

  // Preview Data State
  const [previewRows, setPreviewRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 1. Initial Load: Fetch Filter Options
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    const fetchOptions = async () => {
      try {
        setIsOptionsLoading(true);
        const res = await ExportService.getFilterOptions({ signal: controller.signal });
        if (isMounted && res.success && res.data) {
          setFilterOptions(res.data);
          if (res.data.provinces && res.data.provinces.length === 1) {
            setSelectedProvince(res.data.provinces[0]);
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        console.error('Failed to load filter options:', err);
        toast.error('فشل في جلب خيارات التصفية الجغرافية');
      } finally {
        if (isMounted) setIsOptionsLoading(false);
      }
    };
    fetchOptions();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // 2. Cascading Directorates List
  const availableDirectorates = useMemo(() => {
    if (!selectedProvince) return [];
    return filterOptions.directorates[selectedProvince] || [];
  }, [selectedProvince, filterOptions.directorates]);

  // 3. Cascading Ranks (filtered by chosen Employment Category)
  const availableRanks = useMemo(() => {
    if (!filterOptions.ranks) return [];
    if (!employmentCategory) return filterOptions.ranks;
    return filterOptions.ranks.filter((r) => r.employmentCategory === employmentCategory);
  }, [employmentCategory, filterOptions.ranks]);

  // 4. Smart Dynamic Title Generator
  const generateSmartTitle = useCallback(() => {
    return buildSmartReportTitle({
      reportType,
      selectedProvince,
      selectedDirectorate,
      employmentCategory,
      leaveType,
      caseType,
      categoryMode,
    });
  }, [
    reportType,
    selectedProvince,
    selectedDirectorate,
    employmentCategory,
    leaveType,
    caseType,
    categoryMode,
  ]);

  // Auto-update title unless user manually typed their own custom title
  useEffect(() => {
    if (!isTitleManuallyEdited) {
      setCustomTitle(generateSmartTitle());
    }
  }, [generateSmartTitle, isTitleManuallyEdited]);

  // When changing report type from dropdown
  const handleReportTypeChange = (newType) => {
    if (newType === reportType) return;
    setReportType(newType);
    setIsTitleManuallyEdited(false);
    setLeaveType('');
    setResumeStatus('');
    setDateFrom('');
    setDateTo('');
    setCaseType('');
    setActiveStatus('');
    setCategoryMode('all');
    setSelectedColumns([]);
  };

  // Compile Active Filters
  const currentFilters = useMemo(() => {
    return compileReportFilters({
      reportType,
      selectedProvince,
      selectedDirectorate,
      searchQuery,
      employmentCategory,
      rankId,
      status,
      gender,
      leaveType,
      resumeStatus,
      dateFrom,
      dateTo,
      caseType,
      activeStatus,
      categoryMode,
    });
  }, [
    reportType,
    selectedProvince,
    selectedDirectorate,
    searchQuery,
    employmentCategory,
    rankId,
    status,
    gender,
    leaveType,
    resumeStatus,
    dateFrom,
    dateTo,
    caseType,
    activeStatus,
    categoryMode,
  ]);

  // Fetch Preview Data
  const fetchPreview = useCallback(
    async (colsToUse = selectedColumns, signal = null) => {
      try {
        setIsPreviewLoading(true);
        const res = await ExportService.getPreview(reportType, currentFilters, colsToUse, { signal });
        if (res.success) {
          const count = res.totalCount ?? res.count ?? 0;
          const rows = res.data ?? res.rows ?? [];
          const availCols = res.availableColumns ?? res.columns ?? [];

          setTotalCount(count);
          setPreviewRows(rows);
          if (availCols && availCols.length > 0) {
            setAvailableColumns(availCols);
            if (!colsToUse || colsToUse.length === 0) {
              const defaults = availCols.filter((c) => c.default).map((c) => c.key);
              setSelectedColumns(defaults);
            }
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        console.error('Preview fetch error:', err);
        toast.error('حدث خطأ أثناء تحميل المعاينة الحية');
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [reportType, currentFilters, selectedColumns, toast]
  );

  // Trigger preview when filters or report type change with AbortController
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPreview(selectedColumns, controller.signal);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [reportType, currentFilters]);

  // Column Toggle Handlers
  const handleToggleColumn = (colKey) => {
    let next;
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length <= 1) {
        toast.warning('يجب الإبقاء على عمود واحد على الأقل');
        return;
      }
      next = selectedColumns.filter((k) => k !== colKey);
    } else {
      next = [...selectedColumns, colKey];
    }
    setSelectedColumns(next);
    fetchPreview(next);
  };

  const handleSelectAllColumns = () => {
    const all = availableColumns.map((c) => c.key);
    setSelectedColumns(all);
    fetchPreview(all);
  };

  const handleResetDefaultColumns = () => {
    const defaults = availableColumns.filter((c) => c.default).map((c) => c.key);
    setSelectedColumns(defaults);
    fetchPreview(defaults);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await ExportService.downloadExcel(
        reportType,
        currentFilters,
        selectedColumns,
        customTitle.trim()
      );
      toast.success('تم تصدير ملف الإكسيل الرسمي بنجاح');
    } catch (err) {
      console.error('Export Excel failed:', err);
      toast.error('فشل في تصدير ملف Excel، يرجى المحاولة مرة أخرى');
    } finally {
      setIsExporting(false);
    }
  };

  // Reset All Filters
  const handleResetFilters = () => {
    if (filterOptions.provinces.length > 1) {
      setSelectedProvince('');
    }
    setSelectedDirectorate('');
    setEmploymentCategory('');
    setRankId('');
    setStatus('');
    setGender('');
    setSearchQuery('');
    setLeaveType('');
    setResumeStatus('');
    setDateFrom('');
    setDateTo('');
    setCaseType('');
    setActiveStatus('');
    setCategoryMode('all');
    setIsTitleManuallyEdited(false);
    toast.info('تمت إعادة تعيين الفلاتر');
  };

  // Active columns to render in table
  const activeTableColumns = useMemo(() => {
    if (!availableColumns || availableColumns.length === 0) return [];
    if (!selectedColumns || selectedColumns.length === 0) return availableColumns;
    return availableColumns.filter((c) => selectedColumns.includes(c.key));
  }, [availableColumns, selectedColumns]);

  return {
    reportType,
    handleReportTypeChange,
    filterOptions,
    isOptionsLoading,
    selectedProvince,
    setSelectedProvince,
    selectedDirectorate,
    setSelectedDirectorate,
    availableDirectorates,
    employmentCategory,
    setEmploymentCategory,
    rankId,
    setRankId,
    availableRanks,
    status,
    setStatus,
    gender,
    setGender,
    searchQuery,
    setSearchQuery,
    leaveType,
    setLeaveType,
    resumeStatus,
    setResumeStatus,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    caseType,
    setCaseType,
    activeStatus,
    setActiveStatus,
    categoryMode,
    setCategoryMode,
    customTitle,
    setCustomTitle,
    isTitleManuallyEdited,
    setIsTitleManuallyEdited,
    generateSmartTitle,
    availableColumns,
    selectedColumns,
    handleToggleColumn,
    handleSelectAllColumns,
    handleResetDefaultColumns,
    previewRows,
    totalCount,
    isPreviewLoading,
    isExporting,
    handleExportExcel,
    handleResetFilters,
    fetchPreview,
    activeTableColumns,
  };
}
