import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import useDebounce from '../../hooks/useDebounce';
import EmployeeStatesService from '../../services/employeeStatesService';
import EmployeeStateModal from './EmployeeStateModal';
import UnifiedEntryModal from './UnifiedEntryModal';
import LeavesFilterBar from './components/LeavesFilterBar';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { refreshLeaves, refreshEmployees } from '../../utils/cacheManager';
import { MoreVertical, CalendarOff, ArrowUpDown, Loader2, Trash2, Printer, ChevronRight, ChevronLeft } from 'lucide-react';
import { DateText } from '../../utils/formatDate';
import { printLeaveCertificate } from '../../utils/printLeaveCertificate';
import { formatEmployeeName } from '../../utils/employeeUtils';

const fetcher = async ([_url, page, limit, category, search, directorate, province]) => {
  const result = await EmployeeStatesService.getAll(page, limit, category, search, directorate, province);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const EmployeeStatesList = () => {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search')?.trim() || '');

  const allowedProvinces = getAllowedProvinces(useAuth().user);
  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  // SWR keys are bound ONLY to the debounced value; API search fires from 2+ chars
  const debouncedSearch = useDebounce(searchInput, 500);
  const search = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : '';

  const { data, isLoading, mutate } = useSWR(
    ['/api/employee-states', page, limit, '', search, directorateFilter, provinceFilter],
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const states = Array.isArray(data) ? data : (data?.records || data?.data || []);
  const meta = data?.meta || { total: 0, totalPages: 0, page: 1 };
  const showLoading = isLoading && !data;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Delete confirm state
  const [confirmState, setConfirmState] = useState({ open: false, stateId: null, stateName: '', employeeId: null });

  const handleDelete = (st) => {
    setMenuOpenId(null);
    setConfirmState({ 
      open: true, 
      stateId: st.Id, 
      stateName: st.StateTypeOrReason || '', 
      employeeId: st.EmployeesId || st.EmployeeId 
    });
  };

  const confirmDelete = async () => {
    const { stateId } = confirmState;
    setConfirmState({ open: false, stateId: null, stateName: '', employeeId: null });
    try {
      await EmployeeStatesService.delete(stateId);
      await refreshLeaves();
      await refreshEmployees();
      mutate();
      toast.success('تم حذف السجل بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleAdd = () => {
    setIsUnifiedModalOpen(true);
  };

  const handleUnifiedSuccess = async () => {
    await refreshLeaves();
    await refreshEmployees();
    mutate();
    toast.success('تم تسجيل العطلة بنجاح');
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    await refreshLeaves();
    mutate();
  };

  // ── Isolated Dynamic On-Demand Print Handler ──
  const handlePrint = useCallback(async (st) => {
    setMenuOpenId(null);
    try {
      await printLeaveCertificate(st);
    } catch (err) {
      console.error("Print certificate error:", err);
      toast.error("حدث خطأ أثناء إعداد مستند الطباعة");
    }
  }, [toast]);

  const getRowStatus = (endDateStr, isResumed) => {
    if (isResumed) return 'resumed';
    if (!endDateStr) return 'permanent';

    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) return 'permanent';

    const today = new Date();
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays >= 0 && diffDays <= 7) return 'warning';
    return 'active';
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'resumed': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'overdue': return 'animate-pulse bg-red-100 text-red-800 border border-red-300';
      case 'warning': return 'animate-pulse bg-orange-100 text-orange-800 border border-orange-300';
      case 'permanent': return 'bg-green-100 text-green-800 border border-green-300';
      case 'active':
      default: return 'bg-green-100 text-green-800 border border-green-300';
    }
  };

  const getRowBgStyles = (status) => {
    switch (status) {
      case 'overdue': return 'bg-red-50 hover:bg-red-100';
      case 'warning': return 'bg-orange-50 hover:bg-orange-100';
      case 'resumed':
      case 'permanent':
      case 'active':
      default: return 'bg-white hover:bg-gray-50';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'resumed': return 'تم الاستئناف';
      case 'overdue': return 'لم يستأنف (متأخر)';
      case 'warning': return 'يستأنف قريباً';
      case 'permanent': return 'حالة دائمة';
      case 'active': return 'ساري المفعول';
      default: return '-';
    }
  };

  const HeaderCell = ({ label }) => (
    <th className="py-4 px-4 font-medium text-gray-500 whitespace-nowrap bg-white border-b border-gray-100">
      <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-800 transition-colors">
        {label}
        <ArrowUpDown size={12} className="text-gray-300" />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      {/* Extracted Filter Controls Bar */}
      <LeavesFilterBar
        provinceFilter={provinceFilter}
        setProvinceFilter={setProvinceFilter}
        directorateFilter={directorateFilter}
        setDirectorateFilter={setDirectorateFilter}
        allowedProvinces={allowedProvinces}
        availableMofatishiyat={availableMofatishiyat}
        availableMohafathat={availableMohafathat}
        searchInput={searchInput}
        handleSearchChange={handleSearchChange}
        setPage={setPage}
        canAdd={hasPermission('checkBoxAdd')}
        onAdd={handleAdd}
        addButtonLabel="تسجيل عطلة"
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <HeaderCell label="الموظف" />
                <HeaderCell label="الفئة" />
                <HeaderCell label="النوع" />
                <HeaderCell label="تاريخ البداية" />
                <HeaderCell label="تاريخ النهاية" />
                <HeaderCell label="المدة (أيام)" />
                <HeaderCell label="حالة الاستئناف" />
                <th className="py-4 px-4 font-medium text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {showLoading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : states.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-gray-400">
                    <CalendarOff size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات عطل لعرضها
                  </td>
                </tr>
              ) : (
                states.map((st) => {
                  const status = getRowStatus(st.EndDate, st.IsResumed);
                  return (
                    <tr key={st.Id} className={`${getRowBgStyles(status)} transition-colors group`}>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {formatEmployeeName(st?.Employee, 'غير محدد')}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium">
                        {st?.RecordCategory || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[150px] truncate" title={st?.Type || st?.StateTypeOrReason}>
                        {st?.Type || st?.StateTypeOrReason || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        <DateText value={st?.StartDate} />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        <DateText value={st?.EndDate} />
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 bg-emerald-50/30">
                        {st?.DurationDays || st?.DaysCount || 0}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ${getStatusStyles(status)}`}>
                          {getStatusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="relative inline-block text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === st.Id ? null : st.Id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all cursor-pointer"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {menuOpenId === st.Id && (
                            <div className="absolute left-0 mt-2 w-40 rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-50 py-1">
                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedState(st); setIsModalOpen(true); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  تعديل السجل
                                </button>
                              )}
                              {hasPermission('checkBoxPrint') && (st.RecordCategory?.includes('عطلة') || st.StateTypeOrReason === 'سنوية' || st.StateTypeOrReason === 'عطلة سنوية' || st.StateTypeOrReason === 'عطلة مرضية' || st.StateTypeOrReason === 'عطلة أمومة') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePrint(st); }}
                                  className="w-full text-right px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Printer size={14} />
                                  {st.StateTypeOrReason === 'عطلة مرضية' || st.StateTypeOrReason === 'عطلة أمومة' ? 'طباعة المقرر' : 'طباعة السند'}
                                </button>
                              )}
                              {hasPermission('checkBoxDelete') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(st); }}
                                  className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                                >
                                  <Trash2 size={14} />
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
              id="leaves-prev-page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
              id="leaves-next-page"
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || meta.totalPages === 0}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              التالي
              <ChevronLeft size={15} />
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {states.length} من أصل {meta.total} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
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

      <EmployeeStateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        record={selectedState}
        onSuccess={handleModalSuccess}
      />

      <UnifiedEntryModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        onSuccess={handleUnifiedSuccess}
        defaultCategory="leave"
        hideCategoryTabs={true}
      />

      <ConfirmModal
        open={confirmState.open}
        title="حذف السجل"
        message={`هل أنت متأكد من حذف السجل "${confirmState.stateName}"؟`}
        confirmText="حذف"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, stateId: null, stateName: '' })}
      />
    </div>
  );
};

export default EmployeeStatesList;