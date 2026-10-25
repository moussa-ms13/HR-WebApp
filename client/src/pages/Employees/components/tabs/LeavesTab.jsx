import React, { useState } from 'react';
import useSWR from 'swr';
import apiClient from '../../../../services/apiClient';
import { Calendar, Loader2, SlidersHorizontal, Printer } from 'lucide-react';
import ManageLeaveDebtModal from '../../../Leaves/components/ManageLeaveDebtModal';
import { DateText } from '../../../../utils/formatDate';
import { formatEmployeeName } from '../../../../utils/employeeUtils';
import { useAuth } from '../../../../context/AuthContext';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const getLeaveStatusPill = (leave) => {
  if (leave.IsResumed) {
    return <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">مستأنف</span>;
  }
  const end = new Date(leave.EndDate);
  if (end < new Date()) {
    return <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">منتهي</span>;
  }
  return <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">ساري</span>;
};

const LeavesTab = ({ employee, onRefresh }) => {
  const { hasPermission } = useAuth();
  const id = employee?.Id;
  const [isManageLeaveDebtOpen, setIsManageLeaveDebtOpen] = useState(false);
  const [printingLeaveId, setPrintingLeaveId] = useState(null);

  // Dynamic on-demand certificate printing
  const handlePrintCertificate = async (leave) => {
    setPrintingLeaveId(leave.Id);
    try {
      const { printLeaveCertificate } = await import('../../../../utils/printLeaveCertificate');
      await printLeaveCertificate(leave, employee);
    } catch (err) {
      console.error('Failed to print leave certificate:', err);
    } finally {
      setPrintingLeaveId(null);
    }
  };

  // Fetch leaves history
  const { data: leavesData, isLoading: isLeavesLoading, mutate: mutateLeaves } = useSWR(
    id ? `/employee-states?employeeId=${id}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, dedupingInterval: 60000 }
  );
  const leaves = leavesData?.data || [];

  // Fetch leave balances & debts
  const { data: allBalancesData, mutate: mutateBalances } = useSWR(
    id ? `/leave-balances/employee/${id}/leave-balances` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Robust extraction: handle { data: [...] }, { data: { data: [...] } }, or raw array
  const rawBalances = (() => {
    if (!allBalancesData) return [];
    if (Array.isArray(allBalancesData)) return allBalancesData;
    if (Array.isArray(allBalancesData.data)) return allBalancesData.data;
    if (Array.isArray(allBalancesData.data?.data)) return allBalancesData.data.data;
    if (Array.isArray(allBalancesData.records)) return allBalancesData.records;
    return [];
  })();

  // Normalize keys: handle both PascalCase and camelCase
  const allBalances = rawBalances.map((b) => ({
    Year: b.Year ?? b.year,
    TotalDays: b.TotalDays ?? b.totalDays ?? 30,
    ConsumedDays: b.ConsumedDays ?? b.consumedDays ?? 0,
    RemainingDays: b.RemainingDays ?? b.remainingDays ?? 0,
    Notes: b.Notes ?? b.notes ?? '',
  }));

  // Chronologically sort balances (newest year first)
  const sortedBalances = [...allBalances].sort((a, b) => (b.Year ?? 0) - (a.Year ?? 0));

  // Compute aggregate stats across all recorded years
  const totalRemainingDebt = allBalances.reduce((sum, b) => sum + (b.RemainingDays || 0), 0);
  const totalConsumedDays = allBalances.reduce((sum, b) => sum + (b.ConsumedDays || 0), 0);

  const handleModalClose = () => {
    setIsManageLeaveDebtOpen(false);
    mutateBalances();
    mutateLeaves();
    if (onRefresh) onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* ── Executive Leave Debt Dashboard (Strict 60-30-10 Design) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        {/* Header: Clean title without icon or subtitle + Action button */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">رصيد وديون العطل السنوية</h3>

          {(hasPermission('checkBoxAdd') || hasPermission('checkBoxEdit')) && (
            <button
              type="button"
              onClick={() => setIsManageLeaveDebtOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-xs transition-all cursor-pointer"
              title="إدارة وتعديل رصيد وديون العطل"
            >
              <SlidersHorizontal size={14} />
              <span>إدارة الرصيد والديون</span>
            </button>
          )}
        </div>

        {/* Content Grid */}
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Right Side: Hero Card (60-30-10 Rule: 60% White, 30% Slate, 10% Emerald Accent) */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 border-r-4 border-r-emerald-600 flex flex-col justify-between">
              <div>
                <div className="mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    إجمالي ديون العطل المتبقية
                  </span>
                </div>

                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-5xl font-black tracking-tight text-emerald-700 font-mono">
                    {totalRemainingDebt}
                  </span>
                  <span className="text-sm font-bold text-slate-400">يوم</span>
                </div>

                <p className="text-xs text-slate-400 mt-1 font-medium">
                  الرصيد التراكمي المتاح للاستهلاك القانوني
                </p>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-slate-500 block text-[11px] font-medium mb-1">إجمالي المستهلك</span>
                  <div className="text-base font-bold text-slate-800 flex items-baseline gap-1">
                    <span className="font-mono">{totalConsumedDays}</span>
                    <span className="text-[10px] text-slate-400 font-normal">يوم</span>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-slate-500 block text-[11px] font-medium mb-1">السنوات المسجلة</span>
                  <div className="text-base font-bold text-slate-800 flex items-baseline gap-1">
                    <span className="font-mono">{sortedBalances.length}</span>
                    <span className="text-[10px] text-slate-400 font-normal">سنوات</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left Side: Scalable Multi-Year Breakdown */}
            {sortedBalances.length === 0 ? (
              <div className="lg:col-span-8 flex flex-col items-center justify-center p-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-center min-h-[220px]">
                <Calendar size={32} className="text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700 mb-0.5">لا توجد ديون أو أرصدة مسجلة</p>
                <p className="text-xs text-slate-400 mb-3">يمكنك إضافة ديون وأرصدة العطل عبر زر إدارة الرصيد والديون</p>
                {(hasPermission('checkBoxAdd') || hasPermission('checkBoxEdit')) && (
                  <button
                    type="button"
                    onClick={() => setIsManageLeaveDebtOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-xs"
                  >
                    <SlidersHorizontal size={13} />
                    <span>إضافة رصيد الآن</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="lg:col-span-8 max-h-[340px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortedBalances.map((b) => {
                    const total = b.TotalDays || 30;
                    const consumed = b.ConsumedDays || 0;
                    const remaining = b.RemainingDays || 0;
                    const percentConsumed = Math.min(100, Math.max(0, Math.round((consumed / total) * 100)));

                    const isDepleted = remaining === 0;
                    const isFull = remaining === total;

                    return (
                      <div
                        key={b.Year}
                        className={`rounded-xl p-3.5 transition-all duration-150 border bg-white ${
                          isDepleted
                            ? 'border-slate-200/70 bg-slate-50/50 opacity-75'
                            : 'border-slate-200/90 hover:border-emerald-300 shadow-xs'
                        }`}
                      >
                        {/* Header: Year + Status Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800 font-mono">
                            سنة {b.Year}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isDepleted
                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : isFull
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-teal-50 text-teal-700 border-teal-200'
                            }`}
                          >
                            {isDepleted ? 'مستنفدة' : isFull ? 'مكتملة' : 'متبقية'}
                          </span>
                        </div>

                        {/* Metrics: Remaining & Consumed */}
                        <div className="flex items-center justify-between mb-2 text-xs">
                          <div className="flex items-baseline gap-1">
                            <span className="text-slate-500 text-[11px]">المتبقي:</span>
                            <span className={`font-bold font-mono ${isDepleted ? 'text-slate-400' : 'text-emerald-700'}`}>
                              {remaining} يوم
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            <span>المستهلك: </span>
                            <span className="font-semibold text-slate-700 font-mono">{consumed} / {total} يوم</span>
                          </div>
                        </div>

                        {/* Refined Thin Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isDepleted ? 'bg-slate-300' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${percentConsumed}%` }}
                            title={`تم استهلاك ${percentConsumed}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Leave History Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">سجل الإجازات والحالات</h3>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
              <tr>
                <th className="py-4 px-6 font-medium">النوع / السبب</th>
                <th className="py-4 px-6 font-medium">تاريخ الخروج</th>
                <th className="py-4 px-6 font-medium">تاريخ الاستئناف</th>
                <th className="py-4 px-6 font-medium">المدة (أيام)</th>
                <th className="py-4 px-6 font-medium">الحالة</th>
                <th className="py-4 px-6 font-medium text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isLeavesLoading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد سجلات إجازات لهذا الموظف
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{leave.StateTypeOrReason}</td>
                    <td className="py-4 px-6 text-gray-600"><DateText value={leave.StartDate} /></td>
                    <td className="py-4 px-6 text-gray-600"><DateText value={leave.EndDate} /></td>
                    <td className="py-4 px-6 font-medium text-slate-700">{leave.DaysCount}</td>
                    <td className="py-4 px-6">{getLeaveStatusPill(leave)}</td>
                    <td className="py-4 px-6 text-center">
                      {hasPermission('checkBoxPrint') && (leave.StateTypeOrReason === 'عطلة سنوية' || leave.StateTypeOrReason === 'عطلة مرضية' || leave.StateTypeOrReason === 'عطلة أمومة') ? (
                        <button
                          type="button"
                          onClick={() => handlePrintCertificate(leave)}
                          disabled={printingLeaveId === leave.Id}
                          className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold"
                          title={leave.StateTypeOrReason === 'عطلة مرضية' || leave.StateTypeOrReason === 'عطلة أمومة' ? 'طباعة المقرر' : 'طباعة سند العطلة السنوية'}
                        >
                          {printingLeaveId === leave.Id ? (
                            <Loader2 size={13} className="animate-spin text-emerald-600" />
                          ) : (
                            <Printer size={13} />
                          )}
                          <span>{leave.StateTypeOrReason === 'عطلة مرضية' || leave.StateTypeOrReason === 'عطلة أمومة' ? 'طباعة المقرر' : 'طباعة السند'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Leave Debt Modal */}
      <ManageLeaveDebtModal
        isOpen={isManageLeaveDebtOpen}
        onClose={handleModalClose}
        employeeId={employee?.Id}
        employeeName={formatEmployeeName(employee, '')}
      />
    </div>
  );
};

export default LeavesTab;
