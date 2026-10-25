import React, { useState } from 'react';
import useSWR from 'swr';
import apiClient from '../../../../services/apiClient';
import { useToast } from '../../../../components/ui/Toast';
import { DateText, normalizeEmbeddedDates } from '../../../../utils/dateUtils';
import { refreshEmployeeCareer, refreshEmployees } from '../../../../utils/cacheManager';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  X,
  Calendar,
  FileText,
  Award,
  MessageSquare,
} from 'lucide-react';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const PROMOTION_DURATIONS = [
  { value: 'دنيا', label: 'دنيا (2.5 سنة)' },
  { value: 'متوسطة', label: 'متوسطة (3 سنوات)' },
  { value: 'قصوى', label: 'قصوى (3.5 سنة)' },
];

const renderPaceBadge = (pace) => {
  if (!pace || pace === '—') return null;
  const trimmed = pace.trim();
  if (trimmed.includes('قصوى')) {
    return (
      <span className="w-24 justify-center py-1 rounded-lg text-xs font-semibold border inline-flex items-center bg-emerald-50/90 text-emerald-800 border-emerald-200">
        قصوى
      </span>
    );
  }
  if (trimmed.includes('متوسطة')) {
    return (
      <span className="w-24 justify-center py-1 rounded-lg text-xs font-semibold border inline-flex items-center bg-sky-50/90 text-sky-800 border-sky-200">
        متوسطة
      </span>
    );
  }
  if (trimmed.includes('دنيا')) {
    return (
      <span className="w-24 justify-center py-1 rounded-lg text-xs font-semibold border inline-flex items-center bg-amber-50/90 text-amber-800 border-amber-200">
        دنيا
      </span>
    );
  }
  return (
    <span className="w-24 justify-center py-1 rounded-lg text-xs font-semibold border inline-flex items-center bg-slate-50 text-slate-700 border-slate-200">
      {trimmed}
    </span>
  );
};

const formatReferenceDoc = (doc) => {
  if (!doc || doc === '—') return null;
  const trimmed = doc.trim();
  const cleaned = normalizeEmbeddedDates(trimmed.replace(/^(المقرر|مقرر)\s*:\s*/i, ''));
  if (/^مقرر/i.test(cleaned)) {
    return cleaned;
  }
  return `مقرر ${cleaned}`;
};

const CareerTab = ({ employee, onRefresh, showConfirm, closeConfirm }) => {
  const toast = useToast();
  const id = employee?.Id;

  // --- Career History State ---
  const {
    data: careerData,
    isLoading: isCareerLoading,
    mutate: mutateCareer,
  } = useSWR(id ? `/employees/${id}/career-history` : null, fetcher, { keepPreviousData: true });
  const rankHistory = careerData?.data?.ranks || [];
  const positionHistory = careerData?.data?.positions || [];

  // --- Degree History State ---
  const {
    data: degreeData,
    isLoading: isDegreeLoading,
    mutate: mutateDegrees,
  } = useSWR(id ? `/employees/${id}/degrees` : null, fetcher, { keepPreviousData: true });
  const degreeHistory = degreeData?.data || [];

  // Sort degree history descending: newest/highest first
  const sortedDegrees = [...degreeHistory].sort((a, b) => {
    const dateA = new Date(a.EffectiveDate || 0).getTime();
    const dateB = new Date(b.EffectiveDate || 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (Number(b.DegreeLevel) || 0) - (Number(a.DegreeLevel) || 0);
  });

  const highestExistingDegree = sortedDegrees.length > 0 
    ? Math.max(...sortedDegrees.map(d => Number(d.DegreeLevel) || 0)) 
    : 0;

  const currentDegreeLevel = sortedDegrees.length > 0 
    ? highestExistingDegree 
    : (Number(employee?.Degree) || 0);

  const currentYears = currentDegreeLevel;

  const category = employee?.JobTitle?.Category || employee?.JobTitle?.EmploymentCategory || employee?.EmploymentCategory || '';
  const isContractual = category.includes('متعاقد');

  // Career Modals State
  const [showRankModal, setShowRankModal] = useState(false);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showDegreeModal, setShowDegreeModal] = useState(false);
  const [showContractualModal, setShowContractualModal] = useState(false);

  const initialContractualForm = {
    Years: '',
    EffectiveDate: '',
    ReferenceDoc: '',
    Notes: '',
  };
  const [contractualForm, setContractualForm] = useState(initialContractualForm);

  // Lazy-load job titles when user opens rank modal
  const { data: jobTitlesData } = useSWR(showRankModal ? '/job-titles' : null, fetcher, {
    keepPreviousData: true,
  });
  const jobTitles = jobTitlesData?.data || [];

  const [isSubmittingCareer, setIsSubmittingCareer] = useState(false);
  const [isSubmittingDegree, setIsSubmittingDegree] = useState(false);

  const [editingRankId, setEditingRankId] = useState(null);
  const [editingPositionId, setEditingPositionId] = useState(null);

  const initialRankForm = { RankId: '', RankName: '', InstallDate: '', Reference: '', Notes: '' };
  const [rankForm, setRankForm] = useState(initialRankForm);

  const initialPositionForm = { PositionName: '', InstallDate: '', EndDate: '', Reference: '' };
  const [positionForm, setPositionForm] = useState(initialPositionForm);

  const initialDegreeForm = {
    DegreeLevel: '',
    PromotionDuration: 'دنيا',
    EffectiveDate: '',
    ReferenceDoc: '',
    Notes: '',
  };
  const [degreeForm, setDegreeForm] = useState(initialDegreeForm);

  // --- Rank Handlers ---
  const handleRankSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingCareer(true);
      if (editingRankId) {
        await apiClient.put(`/employees/${id}/rank-history/${editingRankId}`, rankForm);
      } else {
        await apiClient.post(`/employees/${id}/rank-history`, rankForm);
      }
      await refreshEmployeeCareer(id);
      await refreshEmployees(id);
      mutateCareer();
      if (onRefresh) onRefresh();
      setShowRankModal(false);
      setEditingRankId(null);
      setRankForm(initialRankForm);
      toast.success(editingRankId ? 'تم تعديل الترقية بنجاح' : 'تمت إضافة الترقية بنجاح');
    } catch (err) {
      console.error('Failed to add/edit rank', err);
      toast.error('حدث خطأ أثناء حفظ الترقية');
    } finally {
      setIsSubmittingCareer(false);
    }
  };

  const handleEditRank = (record) => {
    setRankForm({
      RankId: record.RankId || '',
      RankName: record.RankName || '',
      InstallDate: record.InstallDate ? new Date(record.InstallDate).toISOString().split('T')[0] : '',
      Reference: record.Reference || '',
      Notes: record.Notes || '',
    });
    setEditingRankId(record.Id);
    setShowRankModal(true);
  };

  const handleDeleteRank = (recordId) => {
    showConfirm('حذف الترقية', 'هل أنت متأكد من حذف هذه الترقية؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/rank-history/${recordId}`);
        await refreshEmployeeCareer(id);
        await refreshEmployees(id);
        mutateCareer();
        if (onRefresh) onRefresh();
        toast.success('تم حذف الترقية بنجاح');
      } catch (err) {
        console.error('Failed to delete rank', err);
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  // --- Position Handlers ---
  const handlePositionSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingCareer(true);
      if (editingPositionId) {
        await apiClient.put(`/employees/${id}/position-history/${editingPositionId}`, positionForm);
      } else {
        await apiClient.post(`/employees/${id}/position-history`, positionForm);
      }
      await refreshEmployeeCareer(id);
      await refreshEmployees(id);
      mutateCareer();
      if (onRefresh) onRefresh();
      setShowPositionModal(false);
      setEditingPositionId(null);
      setPositionForm(initialPositionForm);
      toast.success(editingPositionId ? 'تم تعديل المنصب بنجاح' : 'تمت إضافة المنصب بنجاح');
    } catch (err) {
      console.error('Failed to add/edit position', err);
      toast.error('حدث خطأ أثناء حفظ المنصب');
    } finally {
      setIsSubmittingCareer(false);
    }
  };

  const handleEditPosition = (record) => {
    setPositionForm({
      PositionName: record.PositionName || '',
      InstallDate: record.InstallDate ? new Date(record.InstallDate).toISOString().split('T')[0] : '',
      EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
      Reference: record.Reference || '',
    });
    setEditingPositionId(record.Id);
    setShowPositionModal(true);
  };

  const handleDeletePosition = (recordId) => {
    showConfirm('حذف المنصب', 'هل أنت متأكد من حذف هذا المنصب؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/position-history/${recordId}`);
        await refreshEmployeeCareer(id);
        await refreshEmployees(id);
        mutateCareer();
        if (onRefresh) onRefresh();
        toast.success('تم حذف المنصب بنجاح');
      } catch (err) {
        console.error('Failed to delete position', err);
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  // --- Degree Handlers ---
  const handleDegreeSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingDegree(true);
      await apiClient.post(`/employees/${id}/degrees`, degreeForm);
      await refreshEmployeeCareer(id);
      await refreshEmployees(id);
      mutateDegrees();
      if (onRefresh) onRefresh();
      setShowDegreeModal(false);
      setDegreeForm(initialDegreeForm);
      toast.success('تمت إضافة الدرجة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ الدرجة');
    } finally {
      setIsSubmittingDegree(false);
    }
  };

  const handleDeleteDegree = (degreeId) => {
    showConfirm('حذف الدرجة', 'هل أنت متأكد من حذف هذه الدرجة؟', async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/degrees/${degreeId}`);
        await refreshEmployeeCareer(id);
        await refreshEmployees(id);
        mutateDegrees();
        if (onRefresh) onRefresh();
        toast.success('تم حذف الدرجة بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  // --- Contractual Experience Allowance Handlers ---
  const handleOpenContractualModal = () => {
    const nextYear = highestExistingDegree > 0 ? highestExistingDegree + 1 : 1;
    setContractualForm({
      Years: nextYear,
      EffectiveDate: '',
      ReferenceDoc: '',
      Notes: '',
    });
    setShowContractualModal(true);
  };

  const handleContractualSubmit = async (e) => {
    e.preventDefault();
    const years = Number(contractualForm.Years) || 1;
    const percentage = (years * 1.4).toFixed(1);
    try {
      setIsSubmittingDegree(true);
      await apiClient.post(`/employees/${id}/degrees`, {
        DegreeLevel: years,
        Pace: `${percentage}%`,
        PromotionDuration: `${percentage}%`,
        EffectiveDate: contractualForm.EffectiveDate,
        ReferenceDoc: contractualForm.ReferenceDoc,
        Notes: contractualForm.Notes,
      });
      await refreshEmployeeCareer(id);
      await refreshEmployees(id);
      mutateDegrees();
      if (onRefresh) onRefresh();
      setShowContractualModal(false);
      setContractualForm(initialContractualForm);
      toast.success('تمت إضافة تعويض الخبرة المهنية بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ تعويض الخبرة المهنية');
    } finally {
      setIsSubmittingDegree(false);
    }
  };

  const handleDeleteContractualDegree = (degreeId, degreeYears) => {
    showConfirm('حذف تعويض الخبرة', `هل أنت متأكد من حذف تعويض الخبرة المهنية (${degreeYears} سنة)؟`, async () => {
      closeConfirm();
      try {
        await apiClient.delete(`/employees/${id}/degrees/${degreeId}`);
        await refreshEmployeeCareer(id);
        await refreshEmployees(id);
        mutateDegrees();
        if (onRefresh) onRefresh();
        toast.success('تم حذف تعويض الخبرة المهنية بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Rank History ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            حركة في الرتب
          </h3>
          <button
            onClick={() => {
              setEditingRankId(null);
              setRankForm(initialRankForm);
              setShowRankModal(true);
            }}
            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            إضافة ترقية
          </button>
        </div>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
              <tr>
                <th className="py-4 px-6 font-medium">الرتبة</th>
                <th className="py-4 px-6 font-medium">تاريخ التعيين</th>
                <th className="py-4 px-6 font-medium">المقرر</th>
                <th className="py-4 px-6 font-medium">ملاحظات</th>
                <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isCareerLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : rankHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد حركة ترقيات لهذا الموظف
                  </td>
                </tr>
              ) : (
                rankHistory.map((record) => (
                  <tr key={record.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{record.RankName || '—'}</td>
                    <td className="py-4 px-6 text-gray-600">
                      <DateText value={record.InstallDate} />
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {normalizeEmbeddedDates(record.Reference) || '—'}
                    </td>
                    <td className="py-4 px-6 text-gray-600">{record.Notes || '—'}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditRank(record)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRank(record.Id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Position History ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            حركة في المناصب و المناصب العليا
          </h3>
          <button
            onClick={() => {
              setEditingPositionId(null);
              setPositionForm(initialPositionForm);
              setShowPositionModal(true);
            }}
            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            إضافة منصب
          </button>
        </div>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0">
              <tr>
                <th className="py-4 px-6 font-medium">المنصب</th>
                <th className="py-4 px-6 font-medium">تاريخ التعيين</th>
                <th className="py-4 px-6 font-medium">تاريخ الانتهاء</th>
                <th className="py-4 px-6 font-medium">المقرر</th>
                <th className="py-4 px-6 font-medium w-16 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isCareerLoading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : positionHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <Clock size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد حركة مناصب عليا لهذا الموظف
                  </td>
                </tr>
              ) : (
                positionHistory.map((record) => (
                  <tr key={record.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{record.PositionName || '—'}</td>
                    <td className="py-4 px-6 text-gray-600">
                      <DateText value={record.InstallDate} />
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {record.EndDate ? (
                        <DateText value={record.EndDate} />
                      ) : (
                        <span className="text-emerald-600 font-medium">ساري</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {normalizeEmbeddedDates(record.Reference) || '—'}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditPosition(record)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="تعديل"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePosition(record.Id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Degree History / Professional Experience Allowance ── */}
      {!isContractual ? (
        /* ========================================================
           A. PERMANENT CORPS (حركة في الدرجات 1–12)
           ======================================================== */
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">
              حركة في الدرجات
            </h3>
            <button
              onClick={() => {
                setDegreeForm(initialDegreeForm);
                setShowDegreeModal(true);
              }}
              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer border border-emerald-200/70"
            >
              <Plus size={16} />
              إضافة درجة
            </button>
          </div>

          {/* 12-Grade Visual Progress Bar (Top Summary Strip) */}
          {!isDegreeLoading && sortedDegrees.length > 0 && (
            <div className="bg-slate-50/75 border-b border-gray-200/70 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-700">سلم ترقية الدرجات</span>
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 font-semibold px-2.5 py-0.5 rounded-md text-xs">
                    1 – 12
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-sm font-medium">الدرجة الحالية:</span>
                  <span 
                    className="bg-[#124E35] font-bold px-3.5 py-1 rounded-full text-xs shadow-2xs inline-flex items-center tracking-wide"
                    style={{ color: '#FFFFFF' }}
                  >
                    الدرجة {currentDegreeLevel} / 12
                  </span>
                </div>
              </div>

              {/* Stepper Track */}
              <div className="relative flex items-center justify-between w-full pt-1 pb-2 px-1">
                {/* Background Connecting Line */}
                <div className="absolute top-1/2 right-4 left-4 -translate-y-1/2 h-1 bg-slate-200 z-0 rounded-full" />
                {/* Active Filled Line */}
                <div 
                  className="absolute top-1/2 right-4 -translate-y-1/2 h-1 bg-[#117A4B] z-0 rounded-full transition-all duration-500"
                  style={{
                    width: currentDegreeLevel > 1 
                      ? `calc(${((Math.min(currentDegreeLevel, 12) - 1) / 11) * 100}% - 8px)` 
                      : '0%'
                  }}
                />

                {/* 1 to 12 Step Nodes */}
                {Array.from({ length: 12 }, (_, i) => i + 1).map((step) => {
                  const isCurrent = step === currentDegreeLevel;
                  const isCompleted = step < currentDegreeLevel;

                  return (
                    <div key={step} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 select-none ${
                          isCurrent
                            ? 'bg-[#124E35] text-white ring-4 ring-emerald-500/20 font-bold scale-105 shadow-xs'
                            : isCompleted
                            ? 'bg-[#117A4B] text-white font-semibold'
                            : 'bg-slate-50 text-slate-400 border border-slate-200'
                        }`}
                        title={`الدرجة ${step}${isCurrent ? ' (الحالية)' : ''}`}
                      >
                        {step}
                      </div>
                      <span
                        className={`text-[10px] mt-1 font-medium ${
                          isCurrent
                            ? 'text-[#124E35] font-bold'
                            : isCompleted
                            ? 'text-[#117A4B]'
                            : 'text-slate-400'
                        }`}
                      >
                        د.{step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="p-6">
            {isDegreeLoading ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">جاري تحميل حركة الدرجات...</p>
              </div>
            ) : sortedDegrees.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Award size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">لا توجد حركة درجات مسجلة لهذا الموظف</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  يمكنك البدء بتسجيل الدرجة الأولى وتاريخ سريانها بالنقر على زر "إضافة درجة" أعلاه.
                </p>
              </div>
            ) : (
              /* Vertical Timeline Cards */
              <div className="relative border-r-2 border-slate-200 mr-5 pr-7 space-y-3.5 my-2">
                {sortedDegrees.map((record) => {
                  const isCurrent = record.DegreeLevel === currentDegreeLevel;
                  const docText = formatReferenceDoc(record.ReferenceDoc);

                  return (
                    <div key={record.Id} className="relative group flex items-center">
                      {/* Timeline Node (Right) */}
                      <div
                        className={`absolute -right-[44px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 select-none ${
                          isCurrent
                            ? 'bg-[#124E35] text-white font-bold shadow-xs ring-4 ring-emerald-500/15'
                            : 'bg-white text-slate-700 border-2 border-slate-300 font-bold'
                        }`}
                        title={`الدرجة ${record.DegreeLevel}`}
                      >
                        {record.DegreeLevel}
                      </div>

                      {/* Card Body — Strict 12-Column CSS Grid for Perfect Alignment */}
                      <div
                        className={`w-full grid grid-cols-1 sm:grid-cols-12 items-center gap-3 sm:gap-4 px-5 py-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-white border-slate-200 border-r-4 border-r-[#124E35] shadow-xs'
                            : 'bg-white hover:bg-slate-50/70 border-slate-200/90'
                        }`}
                      >
                        {/* Column 1 — Grade Title (col-span-2) */}
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-base whitespace-nowrap">
                            الدرجة {record.DegreeLevel}
                          </span>
                          {isCurrent && (
                            <span className="bg-emerald-50 text-[#117A4B] border border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">
                              الحالية
                            </span>
                          )}
                        </div>

                        {/* Column 2 — Pace Badge (col-span-2) */}
                        <div className="col-span-1 sm:col-span-2 flex items-center justify-start">
                          {renderPaceBadge(record.PromotionDuration)}
                        </div>

                        {/* Column 3 — Effective Date (col-span-3) */}
                        <div className="col-span-1 sm:col-span-3 flex items-center gap-2 text-sm whitespace-nowrap">
                          <Calendar size={15} className="text-slate-400 shrink-0" />
                          <span className="text-slate-500">تاريخ السريان:</span>
                          <span className="font-bold text-slate-800 tracking-tight">
                            <DateText value={record.EffectiveDate} />
                          </span>
                        </div>

                        {/* Column 4 — Decision Reference (col-span-4) */}
                        <div className="col-span-1 sm:col-span-4 flex items-center justify-start min-w-0">
                          {docText ? (
                            <div
                              className="inline-flex items-center gap-2 bg-slate-50 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-medium max-w-full truncate"
                              title={docText}
                            >
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">{docText}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">بدون مقرر</span>
                          )}
                        </div>

                        {/* Column 5 — Notes & Delete Action (col-span-1) */}
                        <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-2">
                          {record.Notes && record.Notes.trim() && record.Notes !== '—' && (
                            <div
                              className="p-1.5 rounded-md text-amber-700 bg-amber-50 border border-amber-200/70 cursor-help shrink-0 transition-colors hover:bg-amber-100"
                              title={record.Notes}
                            >
                              <MessageSquare size={13} />
                            </div>
                          )}

                          <button
                            onClick={() => handleDeleteDegree(record.Id)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="حذف الدرجة"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================
           B. CONTRACTUAL EMPLOYEES (تعويض الخبرة المهنية - 1.4%)
           ======================================================== */
        <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex flex-col shadow-sm">
          {/* Section Header */}
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-800">
                تعويض الخبرة المهنية
              </h3>
              <span className="bg-slate-100 text-slate-800 border border-slate-300 font-bold px-3 py-1 rounded-md text-xs">
                1.4% لكل سنة
              </span>
            </div>
            <button
              onClick={handleOpenContractualModal}
              className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus size={16} />
              إضافة تعويض خبرة
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {/* Top Executive Summary Strip */}
            {!isDegreeLoading && sortedDegrees.length > 0 && (
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-4 mb-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Right Side */}
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-slate-800">ملخص الخبرة المهنية</span>
                  </div>

                  {/* Center Indicators */}
                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">الأقدمية المحتسبة:</span>
                      <span className="font-bold text-slate-800">{currentYears} سنة</span>
                    </div>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">المعامل السنوي:</span>
                      <span className="font-semibold text-emerald-700">1.4% × السنة</span>
                    </div>
                  </div>

                  {/* Left High-Contrast Summary Formula Badge */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-300 px-3.5 py-1 rounded-lg text-xs font-semibold text-slate-800 whitespace-nowrap">
                    <span className="font-bold text-slate-800">{currentYears} سنة</span>
                    <span className="text-slate-400 font-bold">×</span>
                    <span dir="ltr" className="font-bold text-slate-700">1.4%</span>
                    <span className="text-slate-400 font-bold">=</span>
                    <span dir="ltr" className="font-extrabold text-[#117A4B]">{(currentYears * 1.4).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Sleek Horizontal Progress Bar (Capped against 60% statutory ceiling) */}
                <div className="w-full mt-3 pt-3 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>السقف القانوني (60%)</span>
                    <span className="font-bold text-emerald-800">
                      {(currentYears * 1.4).toFixed(1)}% / 60%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#117A4B] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(((currentYears * 1.4) / 60) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {isDegreeLoading ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">جاري تحميل تعويض الخبرة المهنية...</p>
              </div>
            ) : sortedDegrees.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Award size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">لا توجد سجلات تعويض خبرة مهنية مسجلة لهذا الموظف</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  يمكنك البدء بتسجيل تعويض الخبرة بالنقر على زر "+ إضافة تعويض خبرة" أعلاه.
                </p>
              </div>
            ) : (
              <div>
                {/* 12-Column Ledger Header Bar */}
                <div className="hidden sm:grid sm:grid-cols-12 items-center gap-4 px-5 py-2.5 mb-2 bg-slate-100/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-600">
                  <div className="col-span-3">الأقدمية المحتسبة</div>
                  <div className="col-span-3">معادلة ونسبة التعويض</div>
                  <div className="col-span-2">تاريخ السريان</div>
                  <div className="col-span-3">مرجع المقرر</div>
                  <div className="col-span-1 text-left">إجراء</div>
                </div>

                {/* Structured 12-Column Ledger Row Cards */}
                <div className="space-y-2.5">
                  {sortedDegrees.map((deg) => {
                    const years = Number(deg.DegreeLevel) || 0;
                    const isCurrent = years === currentYears;
                    const docText = formatReferenceDoc(deg.ReferenceDoc);
                    const rate = (years * 1.4).toFixed(1);

                    return (
                      <div
                        key={deg.Id}
                        className={`grid grid-cols-1 sm:grid-cols-12 items-center gap-3 sm:gap-4 px-5 py-3.5 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-white border-slate-300 border-r-4 border-r-[#117A4B] shadow-xs'
                            : 'bg-white hover:bg-slate-50/80 border-slate-200/90'
                        }`}
                      >
                        {/* Column 1 (col-span-3 flex items-center gap-2.5) */}
                        <div className="col-span-1 sm:col-span-3 flex items-center gap-2.5">
                          <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                            {years} سنة خبرة
                          </span>
                          {isCurrent && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200/90 text-[11px] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap">
                              الحالية
                            </span>
                          )}
                        </div>

                        {/* Column 2 (col-span-3 flex items-center justify-start) */}
                        <div className="col-span-1 sm:col-span-3 flex items-center justify-start">
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 whitespace-nowrap">
                            <span className="font-bold text-slate-800">{years} سنة</span>
                            <span className="text-slate-400 font-bold">×</span>
                            <span dir="ltr" className="font-bold text-slate-700">1.4%</span>
                            <span className="text-slate-400 font-bold">=</span>
                            <span dir="ltr" className="font-extrabold text-[#117A4B]">{rate}%</span>
                          </div>
                        </div>

                        {/* Column 3 (col-span-2 flex items-center gap-1.5 text-sm whitespace-nowrap) */}
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-1.5 text-sm whitespace-nowrap">
                          <Calendar size={15} className="text-slate-400 shrink-0" />
                          <span className="text-slate-500 sm:hidden">تاريخ السريان:</span>
                          <span className="font-bold text-slate-800 tracking-tight">
                            <DateText value={deg.EffectiveDate} />
                          </span>
                        </div>

                        {/* Column 4 (col-span-3 flex items-center justify-start min-w-0) */}
                        <div className="col-span-1 sm:col-span-3 flex items-center justify-start min-w-0">
                          {docText ? (
                            <div
                              className="inline-flex items-center gap-2 bg-slate-100/80 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold max-w-full truncate"
                              title={docText}
                            >
                              <FileText size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">{docText}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">بدون مقرر</span>
                          )}
                        </div>

                        {/* Column 5 (col-span-1 flex items-center justify-end gap-2) */}
                        <div className="col-span-1 sm:col-span-1 flex items-center justify-end gap-2">
                          {deg.Notes && deg.Notes.trim() && deg.Notes !== '—' && (
                            <div
                              className="p-1.5 rounded-md text-amber-700 bg-amber-50 border border-amber-200/70 cursor-help shrink-0 transition-colors hover:bg-amber-100"
                              title={deg.Notes}
                            >
                              <MessageSquare size={13} />
                            </div>
                          )}

                          <button
                            onClick={() => handleDeleteContractualDegree(deg.Id, years)}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="حذف تعويض الخبرة"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Rank Modal ── */}
      {showRankModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingRankId ? 'تعديل' : 'إضافة ترقية جديدة'}
              </h2>
              <button
                onClick={() => setShowRankModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleRankSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الرتبة</label>
                <select
                  required
                  value={rankForm.RankId}
                  onChange={(e) => {
                    const selected = jobTitles.find((j) => j.Id === parseInt(e.target.value));
                    setRankForm({ ...rankForm, RankId: e.target.value, RankName: selected ? selected.RankName : '' });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="">-- اختر الرتبة --</option>
                  {jobTitles.map((job) => (
                    <option key={job.Id} value={job.Id}>
                      {job.RankName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين</label>
                <input
                  type="date"
                  required
                  value={rankForm.InstallDate}
                  onChange={(e) => setRankForm({ ...rankForm, InstallDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المقرر</label>
                <input
                  type="text"
                  value={rankForm.Reference}
                  onChange={(e) => setRankForm({ ...rankForm, Reference: e.target.value })}
                  placeholder="مثال: قرار رقم 123"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  value={rankForm.Notes}
                  onChange={(e) => setRankForm({ ...rankForm, Notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowRankModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCareer}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer"
                >
                  {isSubmittingCareer ? <Loader2 className="animate-spin" size={20} /> : editingRankId ? 'تعديل' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Position Modal ── */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingPositionId ? 'تعديل' : 'إضافة منصب جديد'}
              </h2>
              <button
                onClick={() => setShowPositionModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handlePositionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المنصب</label>
                <input
                  type="text"
                  required
                  value={positionForm.PositionName}
                  onChange={(e) => setPositionForm({ ...positionForm, PositionName: e.target.value })}
                  placeholder="مثال: رئيس مصلحة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ التعيين</label>
                <input
                  type="date"
                  required
                  value={positionForm.InstallDate}
                  onChange={(e) => setPositionForm({ ...positionForm, InstallDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  تاريخ الانتهاء <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                </label>
                <input
                  type="date"
                  value={positionForm.EndDate}
                  onChange={(e) => setPositionForm({ ...positionForm, EndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">المقرر</label>
                <input
                  type="text"
                  value={positionForm.Reference}
                  onChange={(e) => setPositionForm({ ...positionForm, Reference: e.target.value })}
                  placeholder="مثال: مقرر رقم 456"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowPositionModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCareer}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer"
                >
                  {isSubmittingCareer ? <Loader2 className="animate-spin" size={20} /> : editingPositionId ? 'تعديل' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Degree Modal ── */}
      {showDegreeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                إضافة درجة جديدة
              </h2>
              <button
                onClick={() => setShowDegreeModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleDegreeSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الدرجة (0 إلى 12)</label>
                <select
                  required
                  value={degreeForm.DegreeLevel}
                  onChange={(e) => setDegreeForm({ ...degreeForm, DegreeLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  <option value="">-- اختر الدرجة --</option>
                  {[...Array(13).keys()].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">الوتيرة / المدة</label>
                <select
                  required
                  value={degreeForm.PromotionDuration}
                  onChange={(e) => setDegreeForm({ ...degreeForm, PromotionDuration: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
                >
                  {PROMOTION_DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">تاريخ السريان</label>
                <input
                  type="date"
                  required
                  value={degreeForm.EffectiveDate}
                  onChange={(e) => setDegreeForm({ ...degreeForm, EffectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">رقم وتاريخ المقرر</label>
                <input
                  type="text"
                  value={degreeForm.ReferenceDoc}
                  onChange={(e) => setDegreeForm({ ...degreeForm, ReferenceDoc: e.target.value })}
                  placeholder="مثال: مقرر رقم 789 بتاريخ 2026/01/01"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ملاحظات <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                </label>
                <textarea
                  value={degreeForm.Notes}
                  onChange={(e) => setDegreeForm({ ...degreeForm, Notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowDegreeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDegree}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer"
                >
                  {isSubmittingDegree ? <Loader2 className="animate-spin" size={20} /> : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Contractual Experience Allowance Modal ── */}
      {showContractualModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col" dir="rtl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                إضافة تعويض خبرة مهنية
              </h2>
              <button
                onClick={() => setShowContractualModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleContractualSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  عدد سنوات الخبرة (الأقدمية) <span className="text-emerald-600 font-bold">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="45"
                  required
                  value={contractualForm.Years}
                  onChange={(e) => setContractualForm({ ...contractualForm, Years: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  placeholder="مثال: 5"
                />
              </div>

              {/* Live Auto-Calculated Preview Card */}
              {(() => {
                const years = Number(contractualForm.Years) || 0;
                const rate = (years * 1.4).toFixed(1);
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">النسبة المئوية المحسوبة:</span>
                    <div className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <span className="font-bold">{years} سنة</span>
                      <span className="text-slate-400">×</span>
                      <span dir="ltr" className="font-bold">1.4%</span>
                      <span className="text-slate-400">=</span>
                      <span dir="ltr" className="font-extrabold text-[#117A4B]">{rate}%</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  تاريخ السريان (يسري مفعوله إبتداء من) <span className="text-emerald-600 font-bold">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={contractualForm.EffectiveDate}
                  onChange={(e) => setContractualForm({ ...contractualForm, EffectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  رقم وتاريخ المقرر
                </label>
                <input
                  type="text"
                  value={contractualForm.ReferenceDoc}
                  onChange={(e) => setContractualForm({ ...contractualForm, ReferenceDoc: e.target.value })}
                  placeholder="مثال: مقرر رقم 1753 بتاريخ 2025/12/02"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ملاحظات <span className="text-slate-400 font-normal text-xs">(اختياري)</span>
                </label>
                <textarea
                  value={contractualForm.Notes}
                  onChange={(e) => setContractualForm({ ...contractualForm, Notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-slate-50 -mx-6 -mb-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowContractualModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDegree}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center min-w-[100px] cursor-pointer"
                >
                  {isSubmittingDegree ? <Loader2 className="animate-spin" size={20} /> : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareerTab;
