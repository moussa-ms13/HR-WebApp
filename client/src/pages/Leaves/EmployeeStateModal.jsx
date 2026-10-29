import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Search, Check, ChevronDown, RotateCcw, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import useDebounce from '../../hooks/useDebounce';
import EmployeeStatesService from '../../services/employeeStatesService';
import EmployeeService from '../../services/employeeService';
import { refreshLeaves, refreshSpecialCases } from '../../utils/cacheManager';
import { useToast } from '../../components/ui/Toast';
import { normalizeGender } from '../../utils/leaveCertificateConfig';
import { formatEmployeeName } from '../../utils/employeeUtils';

// Minimum characters before the employee search API is triggered
const MIN_SEARCH_CHARS = 2;

const LEAVE_TYPES = [
  "عطلة سنوية",
  "عطلة مرضية",
  "عطلة أمومة",
  "عطلة استثنائية",
  "عطلة بدون راتب"
];

const SPECIAL_CASE_TYPES = [
  "في استيداع",
  "تأدية الخدمة الوطنية",
  "توقيف بمقرر",
  "انتداب",
  "استقالة",
  "نقل",
  "تحويل",
  "تقاعد"
];

const PERMANENT_STATES = ["استقالة", "نقل", "تحويل", "تقاعد", "انتداب"];

const EmployeeStateModal = ({ isOpen, onClose, record, onSuccess }) => {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canLeaves = hasPermission('checkBoxLeaves');
  const canSpecialCases = hasPermission('checkBoxSpecialCases');

  const defaultCategory = (!canLeaves && canSpecialCases) ? 'حالة خاصة' : 'تسجيل عطلة';
  const [activeTab, setActiveTab] = useState(defaultCategory);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [formData, setFormData] = useState({
    EmployeesId: '',
    RecordCategory: defaultCategory,
    StateTypeOrReason: LEAVE_TYPES[0],
    DaysCount: 30,
    StartDate: new Date().toISOString().split('T')[0],
    EndDate: '',
    IsResumed: false,
    ActualReturnDate: '',
    Notes: '',
    DoctorName: '',
    CertificateDate: '',
    HasSecondCertificate: false,
    SecondDoctorName: '',
    SecondCertificateDate: '',
  });

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search and Filter States for Employees
  const [searchTerm, setSearchTerm] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // API is triggered ONLY by the debounced value, and only from 2+ chars
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const searchQuery = debouncedSearchTerm.trim().length >= MIN_SEARCH_CHARS ? debouncedSearchTerm.trim() : '';

  const { user } = useAuth();
  const allowedProvinces = getAllowedProvinces(user);
  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (record) {
      // Edit mode: fetch single employee just to display the name
      const fetchOne = async () => {
        try {
          const res = await EmployeeService.getById(record.EmployeesId);
          if (res.success) {
            setSelectedEmployee(res.data);
            setSearchTerm(`${formatEmployeeName(res.data)} (${res.data.Id})`);
          }
        } catch(err) {}
      };
      fetchOne();
      return;
    }
    // Add mode: lightweight debounced search (min 2 chars, abortable)
    if (!searchQuery) {
      setEmployees([]);
      return;
    }
    const controller = new AbortController();
    const fetchEmployeesForSelect = async () => {
      try {
        const res = await EmployeeService.search(searchQuery, {
          province: provinceFilter,
          directorate: directorateFilter,
          signal: controller.signal,
        });
        if (res.success) {
          setEmployees(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return; // aborted
        console.error("Failed to load employees for dropdown", err);
      }
    };
    fetchEmployeesForSelect();
    return () => controller.abort();
  }, [isOpen, record, searchQuery, provinceFilter, directorateFilter]);

  useEffect(() => {
    if (isOpen) {
      if (record) {
        setActiveTab(record.RecordCategory);
        setFormData({
          EmployeesId: record.EmployeesId,
          RecordCategory: record.RecordCategory,
          StateTypeOrReason: record.StateTypeOrReason,
          DaysCount: record.DaysCount,
          StartDate: record.StartDate ? new Date(record.StartDate).toISOString().split('T')[0] : '',
          EndDate: record.EndDate ? new Date(record.EndDate).toISOString().split('T')[0] : '',
          IsResumed: record._openResumption ? true : (record.IsResumed || false),
          ActualReturnDate: record._openResumption
            ? (record.ActualReturnDate ? new Date(record.ActualReturnDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
            : (record.ActualReturnDate ? new Date(record.ActualReturnDate).toISOString().split('T')[0] : ''),
          Notes: record.Notes || '',
          DoctorName: record.DoctorName || '',
          CertificateDate: record.CertificateDate ? new Date(record.CertificateDate).toISOString().split('T')[0] : '',
          HasSecondCertificate: Boolean(record.SecondDoctorName || record.SecondCertificateDate),
          SecondDoctorName: record.SecondDoctorName || '',
          SecondCertificateDate: record.SecondCertificateDate ? new Date(record.SecondCertificateDate).toISOString().split('T')[0] : '',
        });
      } else {
        const initialCategory = (!canLeaves && canSpecialCases) ? 'حالة خاصة' : 'تسجيل عطلة';
        setSelectedEmployee(null);
        setFormData({
          EmployeesId: '',
          RecordCategory: initialCategory,
          StateTypeOrReason: initialCategory === 'حالة خاصة' ? SPECIAL_CASE_TYPES[0] : LEAVE_TYPES[0],
          DaysCount: 30,
          StartDate: new Date().toISOString().split('T')[0],
          EndDate: '',
          IsResumed: false,
          ActualReturnDate: '',
          Notes: '',
          DoctorName: '',
          CertificateDate: '',
          HasSecondCertificate: false,
          SecondDoctorName: '',
          SecondCertificateDate: '',
        });
        setActiveTab(initialCategory);
        setSearchTerm('');
        setProvinceFilter('');
        setDirectorateFilter('');
        setIsDropdownOpen(false);
      }
      setError('');
    }
  }, [isOpen, record]);

  const isSelectedFemale = normalizeGender(
    selectedEmployee?.Gender || selectedEmployee?.gender || record?.Employee?.Gender || record?.Employee?.gender
  ) === 'female';

  const availableLeaveTypes = LEAVE_TYPES.filter(type => {
    if (type === 'عطلة أمومة') {
      return isSelectedFemale;
    }
    return true;
  });

  // If selected employee is not female, reset maternity leave if selected
  useEffect(() => {
    if (!isSelectedFemale && formData.StateTypeOrReason === 'عطلة أمومة') {
      setFormData(prev => ({
        ...prev,
        StateTypeOrReason: LEAVE_TYPES[0],
        DaysCount: 30
      }));
    }
  }, [isSelectedFemale, formData.StateTypeOrReason]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFormData(prev => ({
      ...prev,
      RecordCategory: tab,
      StateTypeOrReason: tab === 'تسجيل عطلة' ? LEAVE_TYPES[0] : SPECIAL_CASE_TYPES[0],
      DaysCount: 30,
      IsResumed: false
    }));
  };

  useEffect(() => {
    if (formData.StartDate && formData.DaysCount > 0) {
      const start = new Date(formData.StartDate);
      start.setDate(start.getDate() + Number(formData.DaysCount) - 1);
      const calculatedEnd = start.toISOString().split('T')[0];

      setFormData(prev => {
        if (prev.EndDate !== calculatedEnd) {
          return { ...prev, EndDate: calculatedEnd };
        }
        return prev;
      });
    }
  }, [formData.StartDate, formData.DaysCount]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };

      if (name === 'StateTypeOrReason') {
        if (PERMANENT_STATES.includes(newValue)) {
          updated.DaysCount = 0;
          updated.IsResumed = true;
        } else if (newValue === 'عطلة أمومة') {
          updated.DaysCount = 150;
          if (prev.StartDate) {
            const start = new Date(prev.StartDate);
            start.setDate(start.getDate() + 150 - 1);
            updated.EndDate = start.toISOString().split('T')[0];
          }
          if (!prev.CertificateDate) {
            updated.CertificateDate = prev.StartDate;
          }
        } else if (newValue === 'عطلة مرضية') {
          if (prev.StateTypeOrReason !== 'عطلة مرضية' && (prev.DaysCount === 30 || prev.DaysCount === 150)) {
            updated.DaysCount = '';
          }
          if (!prev.CertificateDate) {
            updated.CertificateDate = prev.StartDate;
          }
        } else if (prev.DaysCount === 0 || prev.DaysCount === '' || prev.DaysCount === 150) {
          updated.DaysCount = 30;
          updated.IsResumed = false;
        }
      }
      return updated;
    });
  };

  // Live calculation for early resumption preview
  const getEarlyResumptionPreview = () => {
    if (!record || !formData.IsResumed || record.IsResumed || !formData.ActualReturnDate || !formData.StartDate) {
      return null;
    }
    const actualReturn = new Date(formData.ActualReturnDate);
    const start = new Date(formData.StartDate);
    const end = formData.EndDate ? new Date(formData.EndDate) : (record.EndDate ? new Date(record.EndDate) : null);

    if (isNaN(actualReturn.getTime()) || isNaN(start.getTime())) return null;

    const actualUtc = Date.UTC(actualReturn.getFullYear(), actualReturn.getMonth(), actualReturn.getDate());
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = end && !isNaN(end.getTime()) ? Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) : null;

    if (actualUtc < startUtc) {
      return { isInvalid: true, message: 'تاريخ استئناف العمل الفعلي لا يمكن أن يكون قبل تاريخ بداية العطلة.' };
    }

    const diffDays = Math.round((actualUtc - startUtc) / (1000 * 60 * 60 * 24));
    const newDaysCount = Math.max(1, diffDays);
    const originalDays = Number(record.DaysCount || formData.DaysCount || 0);
    const isBeforeEnd = endUtc !== null ? actualUtc < endUtc : newDaysCount < originalDays;
    const refundDays = Math.max(0, originalDays - newDaysCount);

    if (isBeforeEnd && refundDays > 0) {
      const isAnnual = (formData.StateTypeOrReason || record.StateTypeOrReason) === 'عطلة سنوية';
      return {
        isEarly: true,
        originalDays,
        newDaysCount,
        refundDays,
        isAnnual,
        message: isAnnual
          ? `استئناف مبكر: سيتم تقليص مدة العطلة من ${originalDays} إلى ${newDaysCount} يوماً، واسترجاع ${refundDays} يوماً لرصيد الموظف تلقائياً.`
          : `استئناف مبكر: سيتم تقليص مدة العطلة من ${originalDays} إلى ${newDaysCount} يوماً.`
      };
    }
    return null;
  };

  const earlyPreview = getEarlyResumptionPreview();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.EmployeesId) {
      setError('الرجاء اختيار الموظف المعني');
      return;
    }

    const isMedicalLeave = formData.StateTypeOrReason === 'عطلة مرضية' || formData.StateTypeOrReason === 'عطلة أمومة';
    if (formData.RecordCategory === 'تسجيل عطلة' && isMedicalLeave) {
      if (!formData.DoctorName?.trim()) {
        setError('الرجاء إدخال الجهة المصدرة للشهادة الطبية');
        return;
      }
      if (!formData.CertificateDate) {
        setError('الرجاء إدخال تاريخ الشهادة الطبية');
        return;
      }
      if (formData.HasSecondCertificate && !formData.SecondCertificateDate) {
        setError('الرجاء إدخال تاريخ الشهادة الطبية الثانية');
        return;
      }
    }

    if (earlyPreview?.isInvalid) {
      setError(earlyPreview.message);
      return;
    }

    setLoading(true);

    try {
      const empId = Number(formData.EmployeesId);
      const isNewResumption = Boolean(record && formData.IsResumed && !record.IsResumed && formData.ActualReturnDate);

      if (isNewResumption) {
        const resumeRes = await EmployeeStatesService.resume(record.Id, {
          actualReturnDate: formData.ActualReturnDate,
          notes: formData.Notes,
        });

        await refreshLeaves(empId);
        await refreshSpecialCases(empId);

        if (resumeRes?.breakdown?.length > 0) {
          const breakdownSummary = resumeRes.breakdown.map(b => `${b.refunded} يوم لسنة ${b.year}`).join('، ');
          toast.success(`تم استئناف العطلة واسترجاع ${resumeRes.data?.RefundedDays} يوم (${breakdownSummary}) لرصيد الموظف بنجاح.`);
        } else {
          toast.success('تم تسجيل استئناف العمل بنجاح.');
        }

        onSuccess();
        return;
      }

      const emp = selectedEmployee || employees.find(e => e.Id === empId) || record?.Employee;
      const payload = {
        EmployeesId: empId,
        RecordCategory: formData.RecordCategory,
        StateTypeOrReason: formData.StateTypeOrReason,
        DaysCount: Number(formData.DaysCount),
        StartDate: formData.StartDate,
        EndDate: formData.EndDate,
        IsResumed: formData.IsResumed,
        ActualReturnDate: formData.ActualReturnDate || null,
        CurrentJobTitle: emp?.JobTitle?.RankName || emp?.CurrentJobTitle || "",
        Notes: formData.Notes || null,
        DoctorName: isMedicalLeave ? (formData.DoctorName?.trim() || null) : null,
        doctorName: isMedicalLeave ? (formData.DoctorName?.trim() || null) : null,
        CertificateDate: isMedicalLeave ? (formData.CertificateDate || null) : null,
        certificateDate: isMedicalLeave ? (formData.CertificateDate || null) : null,
        SecondDoctorName: isMedicalLeave && formData.HasSecondCertificate
          ? (formData.SecondDoctorName?.trim() || null)
          : null,
        secondDoctorName: isMedicalLeave && formData.HasSecondCertificate
          ? (formData.SecondDoctorName?.trim() || null)
          : null,
        SecondCertificateDate: isMedicalLeave && formData.HasSecondCertificate
          ? (formData.SecondCertificateDate || null)
          : null,
        secondCertificateDate: isMedicalLeave && formData.HasSecondCertificate
          ? (formData.SecondCertificateDate || null)
          : null,
      };

      if (record) {
        await EmployeeStatesService.update(record.Id, payload);
        toast.success('تم تحديث السجل بنجاح.');
      } else {
        await EmployeeStatesService.create(payload);
        toast.success('تم حفظ السجل بنجاح.');
      }

      await refreshLeaves(empId);
      await refreshSpecialCases(empId);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPermanent = PERMANENT_STATES.includes(formData.StateTypeOrReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <h2 className="text-base font-bold text-slate-800">
            {record ? 'تعديل السجل' : 'إضافة سجل جديد (عطلة / حالة خاصة)'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {!record && canLeaves && canSpecialCases && (
          <div className="flex border-b border-slate-100 px-6 bg-white">
            <button
              type="button"
              onClick={() => handleTabChange('تسجيل عطلة')}
              className={`px-5 py-3 font-semibold text-xs border-b-2 outline-none transition-colors ${activeTab === 'تسجيل عطلة'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              تسجيل عطلة
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('حالة خاصة')}
              className={`px-5 py-3 font-semibold text-xs border-b-2 outline-none transition-colors ${activeTab === 'حالة خاصة'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              حالة خاصة
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto bg-white flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-r-4 border-red-500 rounded-lg text-sm font-medium animate-[shake_0.3s_ease-in-out]">
              {error}
            </div>
          )}

          <form id="stateForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  الموظف المعني <span className="text-red-500">*</span>
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={provinceFilter}
                    onChange={(e) => { setProvinceFilter(e.target.value); setDirectorateFilter(''); }}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!!record}
                  >
                    <option value="">الولاية: الكل</option>
                    {allowedProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <select
                    value={directorateFilter}
                    onChange={(e) => setDirectorateFilter(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!!record || !provinceFilter}
                  >
                    <option value="">الجهة: الكل</option>
                    {provinceFilter === 'الشلف' && (
                      <option value="المديرية الجهوية للأملاك الوطنية" className="font-bold text-emerald-700">المديرية الجهوية للأملاك الوطنية</option>
                    )}
                    <option value="مديرية أملاك الدولة" className="font-bold">مديرية أملاك الدولة</option>
                    {availableMofatishiyat.map(item => (
                      <option key={item} value={item}>-- {item}</option>
                    ))}
                    <option value="مديرية مسح الأراضي والحفظ العقاري" className="font-bold">مديرية مسح الأراضي</option>
                    {availableMohafathat.map(item => (
                      <option key={item} value={item}>-- {item}</option>
                    ))}
                  </select>
                </div>
                
                <div className="relative">
                  <Search className="absolute right-3 top-3 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو اللقب أو الرقم..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => !record && setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    disabled={!!record}
                    className="w-full h-10 pr-9 pl-4 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  
                  {isDropdownOpen && !record && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {employees.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          {searchTerm.trim().length < MIN_SEARCH_CHARS ? 'اكتب حرفين على الأقل للبحث...' : 'لا توجد نتائج'}
                        </div>
                      ) : (
                        employees.map(emp => (
                          <div
                            key={emp.Id}
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setFormData(prev => ({ ...prev, EmployeesId: emp.Id }));
                              setSearchTerm(`${formatEmployeeName(emp)} (${emp.Id})`);
                              setIsDropdownOpen(false);
                            }}
                            className={`p-3 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${formData.EmployeesId === emp.Id ? 'bg-emerald-50/60 text-emerald-700' : 'text-slate-700'}`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold">{formatEmployeeName(emp)}</span>
                                <span className="text-gray-400 text-xs">({emp.Id})</span>
                                {emp.EmployeeStatus === 'منقول' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    منقول
                                  </span>
                                )}
                                {emp.EmployeeStatus === 'منتدب' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                    منتدب
                                  </span>
                                )}
                                {emp.EmployeeStatus && !['منقول', 'منتدب', 'نشط', 'مثبت'].includes(emp.EmployeeStatus) && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    {emp.EmployeeStatus}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">{emp.Province} - {emp.Directorate || 'الإدارة العامة'}</div>
                            </div>
                            {formData.EmployeesId === emp.Id && <Check size={16} className="text-emerald-500" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">النوع / السبب <span className="text-red-500">*</span></label>
                <select
                  required
                  name="StateTypeOrReason"
                  value={formData.StateTypeOrReason}
                  onChange={handleChange}
                  className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                >
                  {activeTab === 'تسجيل عطلة'
                    ? availableLeaveTypes.map(t => <option key={t} value={t}>{t}</option>)
                    : SPECIAL_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)
                  }
                </select>
              </div>

              {/* ── Conditional Medical Certificate Inputs (Sick & Maternity Leave) ── */}
              {(formData.StateTypeOrReason === 'عطلة مرضية' || formData.StateTypeOrReason === 'عطلة أمومة') && (
                <div className="md:col-span-2 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>معلومات الشهادة الطبية الأولى</span>
                    <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-600 hover:text-slate-900 select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.HasSecondCertificate)}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          HasSecondCertificate: e.target.checked,
                          ...(!e.target.checked ? { SecondDoctorName: '', SecondCertificateDate: '' } : {})
                        }))}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-medium">إضافة شهادة طبية ثانية (جمع شهادتين)</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 whitespace-nowrap">
                        الجهة المصدرة للشهادة (طبيب / مؤسسة) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        name="DoctorName"
                        placeholder="مثال: د. أحمد بن علي أو المؤسسة العمومية الإستشفائية بالشرفة"
                        value={formData.DoctorName || ''}
                        onChange={handleChange}
                        className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5 whitespace-nowrap">
                        تاريخ الشهادة الطبية <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        name="CertificateDate"
                        value={formData.CertificateDate || ''}
                        onChange={handleChange}
                        className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {/* Optional Second Medical Certificate */}
                  {formData.HasSecondCertificate && (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 animate-[fadeIn_0.2s_ease-out]">
                      <div className="text-xs font-semibold text-slate-700">
                        معلومات الشهادة الطبية الثانية (جمع شهادتين)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div className="flex flex-col justify-end">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5 whitespace-nowrap">
                            الجهة المصدرة للشهادة (طبيب / مؤسسة) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="SecondDoctorName"
                            placeholder="مثال: BOUNEDJMA FATIHA أو عيادة النور"
                            value={formData.SecondDoctorName || ''}
                            onChange={handleChange}
                            className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                          />
                        </div>
                        <div className="flex flex-col justify-end">
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5 whitespace-nowrap">
                            تاريخ الشهادة الطبية الثانية <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required={formData.HasSecondCertificate}
                            name="SecondCertificateDate"
                            value={formData.SecondCertificateDate || ''}
                            onChange={handleChange}
                            className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ البداية <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  name="StartDate"
                  value={formData.StartDate}
                  onChange={handleChange}
                  className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">مدة العطلة/الحالة (أيام) <span className="text-red-500">*</span></label>
                <input
                  required
                  type="number"
                  min="0"
                  name="DaysCount"
                  value={formData.DaysCount}
                  onChange={handleChange}
                  disabled={isPermanent}
                  className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ النهاية المتوقع</label>
                <input
                  type="date"
                  name="EndDate"
                  value={formData.EndDate}
                  readOnly
                  disabled={isPermanent}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg outline-none bg-slate-50 text-slate-500 text-sm cursor-not-allowed disabled:opacity-50"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-400 mt-1">يتم حسابه تلقائياً بناءً على المدة</p>
              </div>

              <div className="border border-slate-200 p-4 rounded-lg bg-white">
                <label className="flex items-center space-x-3 space-x-reverse cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    name="IsResumed"
                    checked={formData.IsResumed}
                    onChange={handleChange}
                    disabled={isPermanent}
                    className="w-4 h-4 rounded border-slate-300 disabled:opacity-50 text-emerald-600 focus:ring-emerald-500"
                    style={{ accentColor: '#105b38' }}
                  />
                  <span className="text-xs font-bold text-slate-700">
                    تم الاستئناف (عاد إلى العمل)
                  </span>
                </label>

                {formData.IsResumed && !isPermanent && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">تاريخ العودة الفعلي <span className="text-red-500">*</span></label>
                      <input
                        required={formData.IsResumed}
                        type="date"
                        name="ActualReturnDate"
                        value={formData.ActualReturnDate}
                        onChange={handleChange}
                        className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                        dir="ltr"
                      />
                    </div>

                    {earlyPreview?.isInvalid && (
                      <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                        <AlertCircle size={15} className="text-red-500 shrink-0" />
                        <span>{earlyPreview.message}</span>
                      </div>
                    )}

                    {earlyPreview?.isEarly && (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-start gap-2">
                        <RotateCcw size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span>{earlyPreview.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات / مرجع إداري</label>
                <textarea
                  name="Notes"
                  value={formData.Notes || ''}
                  onChange={handleChange}
                  rows={2}
                  placeholder="أدخل أي ملاحظات أو مراجع إدارية تتعلق بالعطلة أو الاستئناف..."
                  className="w-full p-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-white rounded-b-xl gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="stateForm"
            disabled={loading}
            className="flex items-center justify-center gap-2 h-10 px-6 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-70 hover:opacity-90 active:scale-[0.98] shadow-xs"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : 'حفظ السجل'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeStateModal;