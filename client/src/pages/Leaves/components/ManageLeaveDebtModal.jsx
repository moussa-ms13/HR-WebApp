import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Loader2, 
  Calendar, 
  Save, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  TrendingDown, 
  Plus
} from 'lucide-react';
import LeaveBalancesService from '../../../services/leaveBalancesService';
import { refreshLeaves } from '../../../utils/cacheManager';
import { useToast } from '../../../components/ui/Toast';
import ConfirmModal from '../../../components/ui/ConfirmModal';

/**
 * ManageLeaveDebtModal
 * 
 * Standalone modal allowing administrators to inspect, add, adjust,
 * and delete annual leave debts/balances for a specific employee.
 * 
 * Props:
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - employeeId: number | string
 *   - employeeName: string
 */
const ManageLeaveDebtModal = ({ isOpen, onClose, employeeId, employeeName }) => {
  const toast = useToast();
  const currentYear = new Date().getFullYear();

  // --- Data & Loading State ---
  const [balances, setBalances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingYear, setDeletingYear] = useState(null);
  const [error, setError] = useState('');

  // --- Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });

  // --- Form State ---
  const [year, setYear] = useState(currentYear);
  const [totalDays, setTotalDays] = useState(30);
  const [remainingDays, setRemainingDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [isEditingRow, setIsEditingRow] = useState(false);

  // Live calculation of consumed days
  const numericTotal = Number(totalDays) || 0;
  const numericRemaining = Number(remainingDays) || 0;
  const consumedDays = Math.max(0, numericTotal - numericRemaining);

  // --- Fetch Balances ---
  const loadBalances = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await LeaveBalancesService.getEmployeeBalances(employeeId);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // Sort years descending
      list.sort((a, b) => (b.Year ?? b.year) - (a.Year ?? a.year));
      setBalances(list);
    } catch (err) {
      console.error('Error fetching balances:', err);
      setError(err.response?.data?.message || err.message || 'تعذر تحميل بيانات رصيد العطل.');
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadBalances();
      resetForm();
    }
  }, [isOpen, employeeId, loadBalances]);

  // --- Form Reset ---
  const resetForm = () => {
    setYear(currentYear);
    setTotalDays(30);
    setRemainingDays(30);
    setNotes('');
    setIsEditingRow(false);
    setError('');
  };

  // --- Select Row For Edit ---
  const handleEditRow = (item) => {
    const rowYear = item.Year ?? item.year;
    const rowTotal = item.TotalDays ?? item.totalDays ?? 30;
    const rowRemaining = item.RemainingDays ?? item.remainingDays ?? 0;
    const rowNotes = item.Notes ?? item.notes ?? '';

    setYear(rowYear);
    setTotalDays(rowTotal);
    setRemainingDays(rowRemaining);
    setNotes(rowNotes);
    setIsEditingRow(true);
    setError('');
  };

  // --- Submit / Save ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const parsedYear = parseInt(year, 10);
    const parsedTotal = parseInt(totalDays, 10);
    const parsedRemaining = parseInt(remainingDays, 10);

    if (isNaN(parsedYear) || parsedYear < 1990 || parsedYear > 2100) {
      setError('يرجى إدخال سنة صحيحة بين 1990 و 2100.');
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('يجب أن يكون الحق السنوي أكبر من صفر.');
      return;
    }
    if (isNaN(parsedRemaining) || parsedRemaining < 0 || parsedRemaining > parsedTotal) {
      setError(`الأيام المتبقية يجب أن تكون بين 0 و ${parsedTotal}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        year: parsedYear,
        totalDays: parsedTotal,
        remainingDays: parsedRemaining,
        notes: notes.trim() || undefined,
      };

      const result = await LeaveBalancesService.upsertBalance(employeeId, payload);
      toast.success(result?.message || `تم حفظ رصيد سنة ${parsedYear} بنجاح.`);

      // Reactive cache invalidation across the app
      await refreshLeaves(employeeId);

      // Refresh local table
      await loadBalances();

      // Reset form
      resetForm();
    } catch (err) {
      console.error('Save balance error:', err);
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ رصيد العطلة.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete Record ---
  const handleDelete = (rowYear) => {
    showConfirm(
      'حذف سجل رصيد السنة',
      `هل أنت متأكد من حذف سجل رصيد سنة ${rowYear} للموظف؟ لا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        closeConfirm();
        setDeletingYear(rowYear);
        setError('');
        try {
          const res = await LeaveBalancesService.deleteBalance(employeeId, rowYear);
          toast.success(res?.message || `تم حذف رصيد سنة ${rowYear} بنجاح.`);

          // Reactive cache invalidation across the app
          await refreshLeaves(employeeId);

          // Refresh local table
          await loadBalances();

          // If the row being edited was deleted, reset form
          if (isEditingRow && year === rowYear) {
            resetForm();
          }
        } catch (err) {
          console.error('Delete balance error:', err);
          setError(err.response?.data?.message || err.message || 'تعذر حذف سجل رصيد السنة.');
        } finally {
          setDeletingYear(null);
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans backdrop-blur-xs animate-in fade-in" 
        dir="rtl"
        onClick={onClose}
      >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              إدارة رصيد وديون العطل
              {employeeName && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {employeeName}
                </span>
              )}
            </h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 custom-scrollbar">

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Add / Edit Form Card ── */}
          <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isEditingRow ? (
                  <>
                    <Edit3 size={17} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-800">تعديل تسوية رصيد سنة {year}</h3>
                  </>
                ) : (
                  <>
                    <Plus size={17} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">إضافة أو تسوية رصيد سنة</h3>
                  </>
                )}
              </div>
              {isEditingRow && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-600 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw size={13} />
                  إلغاء التعديل
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Year */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    السنة <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1990"
                    max="2100"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    disabled={isEditingRow}
                    className={`w-full px-3.5 py-2 text-sm border rounded-xl text-center font-bold outline-none transition-all ${
                      isEditingRow 
                        ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400'
                    }`}
                    placeholder="2026"
                    required
                  />
                </div>

                {/* Total Days */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الحق السنوي (يوم) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={totalDays}
                    onChange={(e) => setTotalDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl text-center font-bold bg-white text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                    required
                  />
                </div>

                {/* Remaining Days */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الرصيد المتبقي (يوم) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={numericTotal}
                    value={remainingDays}
                    onChange={(e) => setRemainingDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl text-center font-bold bg-white text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Live Preview Chips */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <div className="text-center">
                  <div className="text-[11px] text-slate-500">الحق السنوي</div>
                  <div className="text-lg font-extrabold text-blue-600">{numericTotal} <span className="text-[10px] font-normal text-slate-400">يوم</span></div>
                </div>
                <div className="text-center border-x border-slate-100">
                  <div className="text-[11px] text-slate-500">المستهلك (تلقائي)</div>
                  <div className="text-lg font-extrabold text-amber-600">{consumedDays} <span className="text-[10px] font-normal text-slate-400">يوم</span></div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] text-slate-500">المتبقي الصافي</div>
                  <div className={`text-lg font-extrabold ${numericRemaining > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {numericRemaining} <span className="text-[10px] font-normal text-slate-400">يوم</span>
                  </div>
                </div>
              </div>

              {/* Notes / Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  الملاحظات / مرجع التسوية الإدارية <span className="text-xs text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: تسوية رصيد عطلة بموجب محضر اجتماع أو قرار تصفية..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
                />
              </div>

              {/* Form Action */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>حفظ التسوية</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Balances Table Card ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-slate-500" />
                سجل الأرصدة والديون الحالية
              </h3>
              <span className="text-xs text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                {balances.length} {balances.length === 1 ? 'سنة' : 'سنوات'}
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                <Loader2 size={28} className="animate-spin text-emerald-600 mb-2" />
                <span className="text-xs">جاري تحميل بيانات الأرصدة...</span>
              </div>
            ) : balances.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-medium">لا توجد أرصدة مسجلة لهذا الموظف</p>
                <p className="text-xs text-slate-400 mt-1">استخدم النموذج أعلاه لإضافة رصيد سنة أو تسوية دين</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
                      <th className="py-3 px-4 font-bold text-center">السنة</th>
                      <th className="py-3 px-4 font-bold text-center">الحق السنوي</th>
                      <th className="py-3 px-4 font-bold text-center">المستهلك</th>
                      <th className="py-3 px-4 font-bold text-center">المتبقي</th>
                      <th className="py-3 px-4 font-bold">الملاحظات / المرجع</th>
                      <th className="py-3 px-4 font-bold text-center w-24">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {balances.map((item) => {
                      const itemYear = item.Year ?? item.year;
                      const itemTotal = item.TotalDays ?? item.totalDays ?? 30;
                      const itemConsumed = item.ConsumedDays ?? item.consumedDays ?? 0;
                      const itemRemaining = item.RemainingDays ?? item.remainingDays ?? 0;
                      const itemNotes = item.Notes ?? item.notes ?? '';
                      const isRowDeleting = deletingYear === itemYear;
                      const isCurrentEdit = isEditingRow && year === itemYear;

                      return (
                        <tr 
                          key={item.Id ?? item.id ?? itemYear}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCurrentEdit ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          {/* Year */}
                          <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                            {itemYear}
                          </td>

                          {/* Total */}
                          <td className="py-3.5 px-4 text-center text-slate-600 font-semibold">
                            {itemTotal}
                          </td>

                          {/* Consumed */}
                          <td className="py-3.5 px-4 text-center text-amber-600 font-semibold">
                            {itemConsumed}
                          </td>

                          {/* Remaining */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              itemRemaining > 0 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {itemRemaining} يوم
                            </span>
                          </td>

                          {/* Notes */}
                          <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate" title={itemNotes}>
                            {itemNotes || <span className="text-slate-300">—</span>}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditRow(item)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="تعديل"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(itemYear)}
                                disabled={isRowDeleting}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="حذف"
                              >
                                {isRowDeleting ? (
                                  <Loader2 size={15} className="animate-spin text-red-600" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="danger"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  );
};

export default ManageLeaveDebtModal;
