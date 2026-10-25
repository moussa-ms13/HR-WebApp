import React, { useState } from 'react';
import useSWR from 'swr';
import SpecialCasesService from '../../../../services/specialCasesService';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../components/ui/Toast';
import { DateText } from '../../../../utils/formatDate';
import { refreshSpecialCases, refreshEmployees } from '../../../../utils/cacheManager';
import {
  getSpecialCaseStatus,
  isPermanentExit,
  ALL_SPECIAL_CASE_TYPES,
} from '../../../../utils/specialCasesConstants';
import ReintegrateModal from '../../../SpecialCases/components/ReintegrateModal';
import { Shield, Edit3, Trash2, Loader2, UserCheck } from 'lucide-react';

const CASE_TYPE_COLORS = {
  'استقالة': { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  'استيداع': { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  'انتداب': { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  'تحويل': { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
  'نقل': { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-800' },
  'تقاعد': { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' },
};

const SpecialCasesTab = ({ employee, onRefresh, showConfirm, closeConfirm }) => {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const id = employee?.Id;

  // --- Special Cases State ---
  const {
    data: specialCasesData,
    isLoading: isSpecialCasesLoading,
    mutate: mutateSpecialCases,
  } = useSWR(
    id ? [`special-cases-${id}`] : null,
    async () => {
      const res = await SpecialCasesService.getByEmployee(id);
      return res;
    },
    { keepPreviousData: true }
  );
  const specialCases = specialCasesData?.data || [];

  // Form State
  const [showSpecialCaseModal, setShowSpecialCaseModal] = useState(false);
  const [editingSpecialCaseId, setEditingSpecialCaseId] = useState(null);
  const [isSubmittingSpecialCase, setIsSubmittingSpecialCase] = useState(false);
  const initialSpecialCaseForm = {
    CaseType: 'انتداب',
    StartDate: '',
    EndDate: '',
    Destination: '',
    ReferenceDoc: '',
  };
  const [specialCaseForm, setSpecialCaseForm] = useState(initialSpecialCaseForm);

  // Reintegrate Modal State
  const [reintegrateCase, setReintegrateCase] = useState(null);
  const [isReintegrateOpen, setIsReintegrateOpen] = useState(false);

  const handleSpecialCaseSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingSpecialCase(true);
      const isPerm = isPermanentExit(specialCaseForm.CaseType);
      const payload = {
        ...specialCaseForm,
        EndDate: isPerm ? null : (specialCaseForm.EndDate || null),
      };

      if (editingSpecialCaseId) {
        await SpecialCasesService.update(id, editingSpecialCaseId, payload);
      } else {
        await SpecialCasesService.create(id, payload);
      }
      await refreshSpecialCases(id);
      await refreshEmployees(id);
      mutateSpecialCases();
      if (onRefresh) onRefresh();
      setShowSpecialCaseModal(false);
      setEditingSpecialCaseId(null);
      setSpecialCaseForm(initialSpecialCaseForm);
      toast.success(editingSpecialCaseId ? 'تم تعديل الحالة الخاصة بنجاح' : 'تمت إضافة الحالة الخاصة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الحالة الخاصة');
    } finally {
      setIsSubmittingSpecialCase(false);
    }
  };

  const handleEditSpecialCase = (record) => {
    setSpecialCaseForm({
      CaseType: record.CaseType || 'انتداب',
      StartDate: record.StartDate ? new Date(record.StartDate).toISOString().split('T')[0] : '',
      EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
      Destination: record.Destination || '',
      ReferenceDoc: record.ReferenceDoc || '',
    });
    setEditingSpecialCaseId(record.Id);
    setShowSpecialCaseModal(true);
  };

  const handleReintegrateSpecialCase = (record) => {
    setReintegrateCase({
      ...record,
      Employee: employee,
    });
    setIsReintegrateOpen(true);
  };

  const handleDeleteSpecialCase = (caseId) => {
    showConfirm('حذف الحالة الخاصة', 'هل أنت متأكد من حذف هذه الحالة الخاصة؟', async () => {
      closeConfirm();
      try {
        await SpecialCasesService.delete(id, caseId);
        await refreshSpecialCases(id);
        await refreshEmployees(id);
        mutateSpecialCases();
        if (onRefresh) onRefresh();
        toast.success('تم حذف الحالة الخاصة بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  const isFormPerm = isPermanentExit(specialCaseForm.CaseType);

  return (
    <div className="space-y-6">
      {/* Special Cases Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Shield size={20} className="text-emerald-600" />
            سجل الحركات الإدارية والوضعيات القانونية للموظف
          </h3>
        </div>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
              <tr>
                <th className="py-4 px-6 font-medium">النوع</th>
                <th className="py-4 px-6 font-medium">تاريخ السريان</th>
                <th className="py-4 px-6 font-medium">تاريخ النهاية</th>
                <th className="py-4 px-6 font-medium">الوجهة</th>
                <th className="py-4 px-6 font-medium">المرجع</th>
                <th className="py-4 px-6 font-medium text-center">الحالة الإدارية</th>
                <th className="py-4 px-6 font-medium w-24 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isSpecialCasesLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : specialCases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Shield size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد حالات خاصة لهذا الموظف
                  </td>
                </tr>
              ) : (
                specialCases.map((sc) => {
                  const colors = CASE_TYPE_COLORS[sc.CaseType] || {
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200',
                    text: 'text-emerald-800',
                  };
                  const statusInfo = getSpecialCaseStatus(sc);

                  return (
                    <tr key={sc.Id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}
                        >
                          {sc.CaseType}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600 font-mono">
                        <DateText value={sc.StartDate} />
                      </td>
                      <td className="py-4 px-6 text-gray-600 font-mono">
                        {statusInfo.key === 'permanent_exit' ? (
                          <span className="text-blue-600 font-medium text-xs font-sans">قرار نهائي</span>
                        ) : sc.EndDate ? (
                          <DateText value={sc.EndDate} />
                        ) : (
                          <span className="text-emerald-600 font-medium text-xs font-sans">مستمرة</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-gray-600">{sc.Destination || '—'}</td>
                      <td className="py-4 px-6 text-gray-600 max-w-[180px] truncate" title={sc.ReferenceDoc}>
                        {sc.ReferenceDoc || '—'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusInfo.badgeStyle}`}>
                          {statusInfo.badgeLabel}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Reintegrate / End Case Action */}
                          {statusInfo.isReintegratable && hasPermission('checkBoxEdit') && (
                            <button
                              onClick={() => handleReintegrateSpecialCase(sc)}
                              className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-2 rounded-lg transition-colors cursor-pointer"
                              title="إنهاء الحالة (إعادة إدماج)"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}

                          {hasPermission('checkBoxEdit') && (
                            <button
                              onClick={() => handleEditSpecialCase(sc)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}

                          {hasPermission('checkBoxDelete') && (
                            <button
                              onClick={() => handleDeleteSpecialCase(sc.Id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
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
      </div>

      {/* Special Case Edit Modal */}
      {showSpecialCaseModal && editingSpecialCaseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-slate-800">تعديل الحالة الخاصة</h3>
            </div>
            <form onSubmit={handleSpecialCaseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">نوع الحالة</label>
                <select
                  required
                  value={specialCaseForm.CaseType}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, CaseType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  {ALL_SPECIAL_CASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ السريان / البداية</label>
                  <input
                    type="date"
                    required
                    value={specialCaseForm.StartDate}
                    onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, StartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    تاريخ النهاية <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                  </label>
                  {!isFormPerm ? (
                    <input
                      type="date"
                      value={specialCaseForm.EndDate}
                      onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, EndDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    />
                  ) : (
                    <div className="h-10 px-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 flex items-center">
                      قرار نهائي (حركة دائمة)
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  الوجهة / المقر الجديد <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                </label>
                <input
                  type="text"
                  value={specialCaseForm.Destination}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, Destination: e.target.value })}
                  placeholder="مثال: وزارة المالية"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رقم وتاريخ المقرر / القرار</label>
                <input
                  type="text"
                  required
                  value={specialCaseForm.ReferenceDoc}
                  onChange={(e) => setSpecialCaseForm({ ...specialCaseForm, ReferenceDoc: e.target.value })}
                  placeholder="مثال: مقرر رقم 123/2026"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowSpecialCaseModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSpecialCase}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer"
                >
                  {isSubmittingSpecialCase ? <Loader2 className="animate-spin" size={20} /> : 'تعديل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reintegrate Modal */}
      <ReintegrateModal
        isOpen={isReintegrateOpen}
        onClose={() => {
          setIsReintegrateOpen(false);
          setReintegrateCase(null);
        }}
        record={reintegrateCase}
        onSuccess={() => {
          mutateSpecialCases();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};

export default SpecialCasesTab;
