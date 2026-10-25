import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  RotateCcw,
  Search,
  RefreshCw,
  Loader2,
  Check,
  ChevronDown
} from 'lucide-react';
import ExportService from '../../services/exportService';
import { useToast } from '../../components/ui/Toast';
import {
  REPORT_TYPE_OPTIONS,
  buildSmartReportTitle,
  compileReportFilters,
} from './exportConfig';

const CustomExportPage = () => {
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
          // If only 1 province allowed, pre-select it
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

  // 4. Cascading Ranks (filtered by chosen Employment Category)
  const availableRanks = useMemo(() => {
    if (!filterOptions.ranks) return [];
    if (!employmentCategory) return filterOptions.ranks;
    return filterOptions.ranks.filter((r) => r.employmentCategory === employmentCategory);
  }, [employmentCategory, filterOptions.ranks]);

  // 5. Smart Dynamic Title Generator
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
    // Reset report-specific filters
    setLeaveType('');
    setResumeStatus('');
    setDateFrom('');
    setDateTo('');
    setCaseType('');
    setActiveStatus('');
    setCategoryMode('all');
    setSelectedColumns([]); // will be populated from server response
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

  // 6. Fetch Preview Data (Debounced / on filter or column change)
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
            // If selectedColumns is empty, initialize with defaults
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

  // 7. Column Toggle Handlers
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

  // 8. Excel Export Handler
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

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      {/* 1. Standard Native Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التقارير والتصدير</h1>
          <p className="text-sm text-slate-500 mt-1">تخصيص وتصدير القوائم الاسمية</p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-3">
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
            title="إعادة ضبط الفلاتر"
          >
            <RotateCcw size={16} />
            <span>إعادة ضبط</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting || totalCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:bg-[#0e3d29] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            style={{ backgroundColor: '#124E35' }}
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin text-emerald-200" />
                <span>جاري التصدير...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>تصدير Excel ({totalCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Filter & Configuration Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 mb-5 space-y-4">
        {/* Row 1: Primary Filters (Report Type + Workplace) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Report Type Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              نوع القائمة / التقرير
            </label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer"
              >
                {REPORT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Province */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الولاية
            </label>
            <div className="relative">
              <select
                value={selectedProvince}
                onChange={(e) => {
                  setSelectedProvince(e.target.value);
                  setSelectedDirectorate('');
                }}
                disabled={filterOptions.provinces.length === 1}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {filterOptions.provinces.length > 1 && <option value="">جميع الولايات المسموحة</option>}
                {filterOptions.provinces.map((p) => (
                  <option key={p} value={p}>
                    ولاية {p}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Directorate */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              المديرية / الجهة
            </label>
            <div className="relative">
              <select
                value={selectedDirectorate}
                onChange={(e) => {
                  setSelectedDirectorate(e.target.value);
                }}
                disabled={!selectedProvince || availableDirectorates.length === 0}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                <option value="">
                  {!selectedProvince
                    ? 'اختر الولاية أولاً'
                    : availableDirectorates.length === 0
                    ? 'لا توجد جهات مسجلة'
                    : 'جميع المديريات بالولاية'}
                </option>
                {availableDirectorates.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Report-Specific Filters */}
        {reportType === 'nominal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                فئة التوظيف
              </label>
              <select
                value={employmentCategory}
                onChange={(e) => {
                  setEmploymentCategory(e.target.value);
                  setRankId('');
                }}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع فئات التوظيف</option>
                {filterOptions.employmentCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الرتبة الوظيفية
              </label>
              <select
                value={rankId}
                onChange={(e) => setRankId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع الرتب</option>
                {availableRanks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rankName} {r.categoryLevel ? `(صنف ${r.categoryLevel})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الوضعية الإدارية
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع الوضعيات</option>
                <option value="في الخدمة">في الخدمة (نشط)</option>
                <option value="عطلة">في عطلة</option>
                <option value="حالة خاصة">حالة خاصة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الجنس
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">الكل (ذكور وإناث)</option>
                <option value="ذكر">ذكور فقط</option>
                <option value="أنثى">إناث فقط</option>
              </select>
            </div>
          </div>
        )}

        {reportType === 'leaves' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نوع العطلة
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع أنواع العطل</option>
                {filterOptions.leaveTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                حالة الاستئناف
              </label>
              <select
                value={resumeStatus}
                onChange={(e) => setResumeStatus(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع حالات الاستئناف</option>
                <option value="ساري المفعول">ساري المفعول (في عطلة)</option>
                <option value="لم يستأنف (متأخر)">لم يستأنف (متأخر)</option>
                <option value="تم الاستئناف">تم الاستئناف</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                تاريخ البداية (من)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                تاريخ البداية (إلى)
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
            </div>
          </div>
        )}

        {reportType === 'special-cases' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نوع الحالة الخاصة
              </label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع الحالات الخاصة</option>
                {filterOptions.specialCaseTypes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                سريان الحالة
              </label>
              <select
                value={activeStatus}
                onChange={(e) => setActiveStatus(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="">جميع الوضعيات</option>
                <option value="ساري المفعول">ساري المفعول</option>
                <option value="منتهي">منتهي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                تاريخ السريان (من)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                تاريخ السريان (إلى)
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
            </div>
          </div>
        )}

        {reportType === 'degrees-experience' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                نمط الترقية / الفئة المهنية
              </label>
              <select
                value={categoryMode}
                onChange={(e) => setCategoryMode(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              >
                <option value="all">الكل (مرسمون ومتعاقدون)</option>
                <option value="grades">الدرجات (1-12) للمرسمين</option>
                <option value="experience">تعويض الخبرة (1.4%) للمتعاقدين</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                البحث السريع
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، اللقب، أو الرتبة..."
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
                />
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Quick Search (for other templates) + Title Input */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
          {reportType !== 'degrees-experience' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                البحث السريع
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باللقب، الاسم، أو رقم التعريف..."
                  className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
                />
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          )}

          <div className={reportType === 'degrees-experience' ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                عنوان القائمة في ملف الإكسيل
              </label>
              {isTitleManuallyEdited && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTitleManuallyEdited(false);
                    setCustomTitle(generateSmartTitle());
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-800 underline font-medium"
                >
                  استعادة العنوان التلقائي
                </button>
              )}
            </div>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                setIsTitleManuallyEdited(true);
              }}
              placeholder="اكتب العنوان هنا..."
              className="w-full text-xs font-bold bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
            />
          </div>
        </div>

        {/* Row 4: Subtle Column Selector (Native rectangular chips) */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              الأعمدة المعروضة في التقرير{' '}
              <span className="text-slate-400 font-normal">
                ({selectedColumns.length} من {availableColumns.length})
              </span>
            </span>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAllColumns}
                className="text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 rounded hover:bg-emerald-50 transition-colors"
              >
                تحديد الكل
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleResetDefaultColumns}
                className="text-slate-500 hover:text-slate-700 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors"
              >
                الأعمدة الافتراضية
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availableColumns.map((col) => {
              const isSelected = selectedColumns.includes(col.key);
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => handleToggleColumn(col.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                    isSelected
                      ? 'bg-emerald-50/90 text-[#124E35] border-emerald-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  {isSelected && <Check size={12} className="text-emerald-700 shrink-0" />}
                  <span>{col.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Data Preview Table (Native Design Language) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
        {/* Understated Header Bar */}
        <div className="p-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-700">
              معاينة القائمة ({totalCount})
            </h2>
            {isPreviewLoading && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin text-emerald-600" /> جاري التحديث...
              </span>
            )}
          </div>

          <button
            onClick={() => fetchPreview()}
            disabled={isPreviewLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors disabled:opacity-50"
            title="تحديث المعاينة"
          >
            <RefreshCw size={13} className={isPreviewLoading ? 'animate-spin text-emerald-600' : ''} />
            <span>تحديث</span>
          </button>
        </div>

        {/* Table with Native Styling (Slate Header) */}
        <div className="overflow-x-auto flex-1 max-h-[560px] custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50/90 border-b border-slate-200">
              <tr>
                {activeTableColumns.map((col) => (
                  <th
                    key={col.key}
                    className="py-3 px-3.5 font-semibold text-slate-600 text-xs whitespace-nowrap"
                    style={{ textAlign: col.align || 'right' }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-xs">
              {isPreviewLoading ? (
                Array.from({ length: 6 }).map((_, rIdx) => (
                  <tr key={`skel-${rIdx}`} className="animate-pulse">
                    {activeTableColumns.map((col, cIdx) => (
                      <td key={`skel-td-${cIdx}`} className="py-3 px-3.5">
                        <div className="h-3.5 bg-slate-200/70 rounded-sm w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : previewRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeTableColumns.length || 1}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Search size={20} className="text-slate-300" />
                      <span className="font-semibold text-slate-600 text-sm">
                        لا توجد سجلات مطابقة لمعايير التصفية المحددة
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                previewRows.map((row, rowIdx) => (
                  <tr
                    key={row.id || `row-${rowIdx}`}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    {activeTableColumns.map((col) => {
                      const val = row[col.key];
                      const isIndex = col.key === 'index';
                      const isFr = col.key === 'fullNameFr';
                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3.5 text-slate-700 whitespace-nowrap font-medium ${
                            isIndex ? 'text-slate-400 font-mono text-[11px]' : ''
                          } ${isFr ? 'font-sans text-[11px] text-slate-600' : ''}`}
                          style={{ textAlign: col.align || 'right' }}
                        >
                          {val !== undefined && val !== null && val !== '' ? (
                            String(val)
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Native Footer */}
        <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>إجمالي السجلات: {totalCount}</span>
          <span>عرض {previewRows.length} سجل في المعاينة الحية</span>
        </div>
      </div>
    </div>
  );
};

export default CustomExportPage;
