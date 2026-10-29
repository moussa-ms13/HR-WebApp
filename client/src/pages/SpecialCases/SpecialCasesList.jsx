import React, { useState } from 'react';
import useSWR from 'swr';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import useDebounce from '../../hooks/useDebounce';
import SpecialCasesService from '../../services/specialCasesService';
import SpecialCaseModal from './components/SpecialCaseModal';
import ReintegrateModal from './components/ReintegrateModal';
import LeavesFilterBar from '../Leaves/components/LeavesFilterBar';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { refreshSpecialCases, refreshEmployees } from '../../utils/cacheManager';
import { DateText, normalizeEmbeddedDates } from '../../utils/dateUtils';
import { formatEmployeeName } from '../../utils/employeeUtils';
import {
  RECORD_VIEW_OPTIONS,
  DEFAULT_RECORD_VIEW,
  ALL_SPECIAL_CASE_TYPES,
  getSpecialCaseStatus,
} from '../../utils/specialCasesConstants';
import { SpecialCaseStatusBadge } from '../../components/common/UnifiedBadge';
import {
  ArrowRightLeft,
  ArrowUpDown,
  MoreVertical,
  Loader2,
  Trash2,
  Edit2,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react';

const casesFetcher = async ([_url, page, limit, search, directorate, province, statusFilter, caseType, year, sortBy, sortOrder]) => {
  const result = await SpecialCasesService.getAll(
    page,
    limit,
    search,
    province,
    directorate,
    statusFilter,
    caseType,
    year,
    sortBy,
    sortOrder
  );
  if (!result.success) throw new Error('فشل جلب الحالات الخاصة');
  return result;
};

export default function SpecialCasesList() {
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [statusFilter, setStatusFilter] = useState(DEFAULT_RECORD_VIEW);
  const [caseTypeFilter, setCaseTypeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search')?.trim() || '');

  // Sorting state
  const [sortBy, setSortBy] = useState('Id');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'Id' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const allowedProvinces = getAllowedProvinces(user);
  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  const debouncedSearch = useDebounce(searchInput, 500);
  const search = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : '';

  const currentYear = new Date().getFullYear();
  const isPastYear = Boolean(yearFilter) && Number(yearFilter) < currentYear;

  // When searching or selecting a past year from the default operational view,
  // automatically search across ALL records so historical / exit cases appear immediately.
  const isSearchAcrossAll = Boolean(search) && statusFilter === DEFAULT_RECORD_VIEW;
  const isPastYearAcrossAll = isPastYear && statusFilter === DEFAULT_RECORD_VIEW;
  const isAutoExpanded = isSearchAcrossAll || isPastYearAcrossAll;
  const effectiveStatusFilter = isAutoExpanded ? 'all' : statusFilter;

  const { data, isLoading, mutate } = useSWR(
    ['/api/special-cases', page, limit, search, directorateFilter, provinceFilter, effectiveStatusFilter, caseTypeFilter, yearFilter, sortBy, sortOrder],
    casesFetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const specialCases = Array.isArray(data) ? data : (data?.data || data?.records || []);
  const meta = data?.meta || { total: 0, totalPages: 0, page: 1, counts: {}, years: [] };
  const showLoading = isLoading && !data;

  // "عرض السجلات" dropdown options with live counts
  const viewOptions = RECORD_VIEW_OPTIONS.map((opt) => {
    const count = meta.counts?.[opt.id];
    return {
      value: opt.id,
      label: count !== undefined ? `${opt.label} (${count})` : opt.label,
    };
  });

  // "السنة" dropdown: distinct years from DB + current year (+ selected year), desc
  const yearOptions = Array.from(
    new Set([
      new Date().getFullYear(),
      ...(Array.isArray(meta.years) ? meta.years : []),
      ...(yearFilter ? [Number(yearFilter)] : []),
    ])
  )
    .filter((y) => Number.isInteger(y) && y > 0)
    .sort((a, b) => b - a);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Reintegrate Modal State
  const [reintegrateCase, setReintegrateCase] = useState(null);
  const [isReintegrateOpen, setIsReintegrateOpen] = useState(false);

  // Delete Confirm State
  const [confirmState, setConfirmState] = useState({
    open: false,
    caseId: null,
    caseName: '',
    employeeId: null,
  });

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleAdd = () => {
    setSelectedCase(null);
    setIsModalOpen(true);
  };

  const handleEdit = (c) => {
    setMenuOpenId(null);
    setSelectedCase(c);
    setIsModalOpen(true);
  };

  const handleReintegrateClick = (c) => {
    setMenuOpenId(null);
    setReintegrateCase(c);
    setIsReintegrateOpen(true);
  };

  const handleDeleteClick = (c) => {
    setMenuOpenId(null);
    setConfirmState({
      open: true,
      caseId: c.Id,
      caseName: `${c.CaseType} للموظف ${formatEmployeeName(c.Employee, '')}`,
      employeeId: c.EmployeesId || c.EmployeeId,
    });
  };

  const confirmDelete = async () => {
    const { caseId, employeeId } = confirmState;
    setConfirmState({ open: false, caseId: null, caseName: '', employeeId: null });

    try {
      if (!employeeId) throw new Error('معرّف الموظف غير متوفر');
      await SpecialCasesService.delete(employeeId, caseId);
      await refreshSpecialCases(employeeId);
      await refreshEmployees(employeeId);
      mutate();
      toast.success('تم حذف الحالة الخاصة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleModalSuccess = async () => {
    mutate();
  };

  const getRowBgStyles = (statusKey) => {
    switch (statusKey) {
      case 'archived': return 'bg-gray-50/60 hover:bg-gray-100/60 text-slate-500';
      case 'permanent_exit': return 'bg-white hover:bg-blue-50/30';
      case 'temporary_active':
      default: return 'bg-white hover:bg-emerald-50/20';
    }
  };

  const HeaderCell = ({ 
    label, 
    sortKey = null, 
    currentSort = '', 
    onSort = null, 
    align = 'right', 
    className = '' 
  }) => {
    const isSorted = sortKey && currentSort === sortKey;
    return (
      <th 
        onClick={() => sortKey && onSort?.(sortKey)}
        className={`py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 select-none ${
          sortKey ? 'cursor-pointer hover:bg-slate-50/80 hover:text-slate-800 group transition-colors' : ''
        } ${align === 'center' ? 'text-center' : ''} ${className}`}
      >
        <div className={`flex items-center gap-1.5 transition-colors ${align === 'center' ? 'justify-center' : ''}`}>
          <span className={isSorted ? 'text-slate-900 font-semibold' : ''}>{label}</span>
          {sortKey && (
            <ArrowUpDown 
              size={12} 
              className={`transition-colors ${
                isSorted 
                  ? 'text-[#10B981] font-bold' 
                  : 'text-gray-300 group-hover:text-gray-500'
              }`} 
            />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      {/* Filter Controls Bar (includes عرض السجلات + السنة) */}
      <LeavesFilterBar
        viewFilter={statusFilter}
        setViewFilter={setStatusFilter}
        viewOptions={viewOptions}
        provinceFilter={provinceFilter}
        setProvinceFilter={setProvinceFilter}
        directorateFilter={directorateFilter}
        setDirectorateFilter={setDirectorateFilter}
        caseTypeFilter={caseTypeFilter}
        setCaseTypeFilter={setCaseTypeFilter}
        caseTypeOptions={ALL_SPECIAL_CASE_TYPES}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
        yearOptions={yearOptions}
        allowedProvinces={allowedProvinces}
        availableMofatishiyat={availableMofatishiyat}
        availableMohafathat={availableMohafathat}
        searchInput={searchInput}
        handleSearchChange={handleSearchChange}
        setPage={setPage}
        canAdd={hasPermission('checkBoxAdd')}
        onAdd={handleAdd}
        addButtonLabel="تسجيل حالة خاصة"
        searchPlaceholder="البحث باسم الموظف أو نوع الحالة..."
      />

      {isSearchAcrossAll && (
        <div
          id="special-cases-search-scope-hint"
          className="-mt-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100 text-xs font-medium text-sky-800"
        >
          <Info size={14} className="shrink-0 text-sky-600" />
          يتم البحث في جميع السجلات (السارية، الخروج النهائي، والأرشيف) لضمان العثور على أي موظف.
        </div>
      )}

      {isPastYearAcrossAll && !isSearchAcrossAll && (
        <div
          id="special-cases-year-scope-hint"
          className="-mt-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-xs font-medium text-amber-800"
        >
          <Info size={14} className="shrink-0 text-amber-600" />
          عرض سجلات سنة {yearFilter} عبر كافة الحالات (السارية، الخروج النهائي، والأرشيف التاريخي).
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <HeaderCell label="الموظف" sortKey="Employee" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="نوع الحالة" sortKey="CaseType" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="الوجهة / المقر الجديد" sortKey="Destination" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="رقم وتاريخ المقرر" sortKey="ReferenceDoc" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="تاريخ السريان" sortKey="StartDate" currentSort={sortBy} onSort={handleSort} />
                <HeaderCell label="الحالة الإدارية" sortKey="Status" currentSort={sortBy} onSort={handleSort} align="center" />
                <th className="py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 text-center select-none">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {showLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : specialCases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <ArrowRightLeft size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد حالات خاصة تطابق الفلاتر المحددة
                  </td>
                </tr>
              ) : (
                specialCases.map((c) => {
                  const statusInfo = getSpecialCaseStatus(c);
                  const empId = c.EmployeesId || c.EmployeeId;
                  return (
                    <tr key={c.Id} className={`${getRowBgStyles(statusInfo.key)} transition-colors group`}>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <Link
                          to={`/employees/${empId}`}
                          className="hover:text-emerald-700 transition-colors"
                        >
                          {formatEmployeeName(c.Employee, 'غير محدد')}
                        </Link>
                        {c.Employee?.Province && (
                          <div className="text-xs text-gray-400 font-normal mt-0.5">
                            ولاية {c.Employee.Province}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-gray-700 font-medium max-w-[150px] truncate" title={c?.CaseType}>
                        {c?.CaseType || '-'}
                      </td>

                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[170px] truncate" title={c?.Destination || ''}>
                        {c?.Destination || '-'}
                      </td>

                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[200px] truncate" title={c?.ReferenceDoc || ''}>
                        {normalizeEmbeddedDates(c?.ReferenceDoc) || '-'}
                      </td>

                      <td className="py-3 px-4 font-mono text-gray-600">
                        <DateText value={c?.StartDate} />
                        {statusInfo.key === 'permanent_exit' ? (
                          <span className="text-xs text-blue-600 block font-sans font-medium">
                            قرار نهائي
                          </span>
                        ) : c?.EndDate ? (
                          <span className="text-xs text-gray-400 block font-sans">
                            إلى <DateText value={c?.EndDate} />
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 block font-sans font-medium">
                            مستمرة
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <SpecialCaseStatusBadge status={statusInfo} />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="relative inline-block text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === c.Id ? null : c.Id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all cursor-pointer"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {menuOpenId === c.Id && (
                            <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-50 py-1 font-sans">
                              {/* Reintegrate / End Case Action for Active Temporary Cases */}
                              {statusInfo.isReintegratable && hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReintegrateClick(c);
                                  }}
                                  className="w-full text-right px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <UserCheck size={15} className="text-emerald-600" />
                                  إنهاء الحالة (إعادة إدماج)
                                </button>
                              )}

                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(c);
                                  }}
                                  className="w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Edit2 size={14} className="text-gray-400" />
                                  تعديل الحالة الخاصة
                                </button>
                              )}

                              {hasPermission('checkBoxDelete') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(c);
                                  }}
                                  className="w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-gray-100"
                                >
                                  <Trash2 size={14} className="text-red-500" />
                                  حذف
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {/* RTL order: السابق (right) → page (middle) → التالي (left) */}
          <div className="flex gap-2">
            <button
              id="special-cases-prev-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ChevronRight size={15} />
              السابق
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {meta.page}
            </button>
            <button
              id="special-cases-next-page"
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || meta.totalPages === 0}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              التالي
              <ChevronLeft size={15} />
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {specialCases.length} من أصل {meta.total} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-slate-800 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            مدخلات
          </div>
        </div>
      </div>

      <SpecialCaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        record={selectedCase}
        onSuccess={handleModalSuccess}
      />

      <ReintegrateModal
        isOpen={isReintegrateOpen}
        onClose={() => {
          setIsReintegrateOpen(false);
          setReintegrateCase(null);
        }}
        record={reintegrateCase}
        onSuccess={handleModalSuccess}
      />

      <ConfirmModal
        open={confirmState.open}
        title="حذف الحالة الخاصة"
        message={`هل أنت متأكد من حذف "${confirmState.caseName}"؟`}
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, caseId: null, caseName: '', employeeId: null })}
      />
    </div>
  );
}
