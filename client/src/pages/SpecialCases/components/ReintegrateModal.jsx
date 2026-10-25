import React, { useState, useEffect } from 'react';
import { X, Loader2, UserCheck, AlertCircle } from 'lucide-react';
import SpecialCasesService from '../../../services/specialCasesService';
import { refreshSpecialCases, refreshEmployees } from '../../../utils/cacheManager';
import { useToast } from '../../../components/ui/Toast';
import { formatEmployeeName } from '../../../utils/employeeUtils';

export default function ReintegrateModal({
  isOpen,
  onClose,
  record,
  onSuccess,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [reinstatementDoc, setReinstatementDoc] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEndDate(new Date().toISOString().split('T')[0]);
      setReinstatementDoc('');
      setLoading(false);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const employeeId = record.EmployeesId || record.EmployeeId || record.Employee?.Id;
  const employeeName = formatEmployeeName(record.Employee, 'الموظف المعني');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!endDate) {
      toast.error('يرجى تحديد تاريخ إنهاء الحالة');
      return;
    }

    try {
      setLoading(true);
      await SpecialCasesService.endCase(employeeId, record.Id, {
        endDate,
        reinstatementDoc,
      });

      if (employeeId) {
        await refreshSpecialCases(employeeId);
        await refreshEmployees(employeeId);
      }

      toast.success('تم إنهاء الحالة وإعادة إدماج الموظف بنجاح');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'فشل إنهاء الحالة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[scaleIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                إنهاء الحالة وإعادة الإدماج
              </h2>
              <p className="text-xs text-gray-500">
                {employeeName} — {record.CaseType}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-slate-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Info Banner */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/70 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 leading-relaxed">
            <AlertCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              سيتم تعيين تاريخ النهاية وإغلاق الحالة ونقلها تلقائياً إلى <strong>الأرشيف</strong> مع استرجاع الوضعية والمنصب الأصلي للموظف في الهيكل الإداري.
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ إنهاء الحالة / استئناف العمل <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
              dir="ltr"
            />
          </div>

          {/* Reinstatement Reference Doc */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              رقم وتاريخ مقرر إعادة الإدماج <span className="text-slate-400 font-normal">(اختياري)</span>
            </label>
            <input
              type="text"
              value={reinstatementDoc}
              onChange={(e) => setReinstatementDoc(e.target.value)}
              placeholder="مثال: مقرر رقم 145/2026 بتاريخ 2026/10/22"
              className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>تأكيد إنهاء الحالة وإعادة الإدماج</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
