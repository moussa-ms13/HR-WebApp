import React, { useState, useEffect } from 'react';
import { refreshLeaves, refreshSpecialCases } from '../../utils/cacheManager';
import { X, Loader2, Calendar, Search, Check, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import useDebounce from '../../hooks/useDebounce';
import EmployeeStatesService from '../../services/employeeStatesService';
import SpecialCasesService from '../../services/specialCasesService';
import EmployeeService from '../../services/employeeService';
import { normalizeGender } from '../../utils/leaveCertificateConfig';
import { formatEmployeeName } from '../../utils/employeeUtils';

// Minimum characters before the employee search API is triggered
const MIN_SEARCH_CHARS = 2;

// ── Type Constants ──────────────────────────────────────────
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

// Permanent cases: no EndDate
const PERMANENT_CASES = new Set(["استقالة", "تقاعد", "نقل"]);

// Cases requiring a Destination field
const DESTINATION_CASES = new Set(["انتداب", "تحويل", "نقل"]);

// ── Component ───────────────────────────────────────────────
const UnifiedEntryModal = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedEmployee = null,
  defaultCategory = 'leave',
  hideCategoryTabs = false
}) => {
  const { user, hasPermission } = useAuth();
  const allowedProvinces = getAllowedProvinces(user);

  const canLeaves = hasPermission('checkBoxLeaves');
  const canSpecialCases = hasPermission('checkBoxSpecialCases');

  const resolvedDefaultCategory = (() => {
    if (defaultCategory === 'leave' && !canLeaves && canSpecialCases) return 'special_case';
    if (defaultCategory === 'special_case' && !canSpecialCases && canLeaves) return 'leave';
    return defaultCategory;
  })();

  // ── Core State ──
  const [entryCategory, setEntryCategory] = useState(resolvedDefaultCategory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Employee Search State ──
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // API is triggered ONLY by the debounced value, and only from 2+ chars
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const searchQuery = debouncedSearchTerm.trim().length >= MIN_SEARCH_CHARS ? debouncedSearchTerm.trim() : '';

  // ── Leave Fields ──
  const [leaveForm, setLeaveForm] = useState({
    StateTypeOrReason: LEAVE_TYPES[0],
    StartDate: new Date().toISOString().split('T')[0],
    DaysCount: 30,
    EndDate: '',
    Notes: '',
    DoctorName: '',
    CertificateDate: '',
    HasSecondCertificate: false,
    SecondDoctorName: '',
    SecondCertificateDate: '',
  });

  // ── Special Case Fields ──
  const [caseForm, setCaseForm] = useState({
    CaseType: SPECIAL_CASE_TYPES[0],
    StartDate: new Date().toISOString().split('T')[0],
    EndDate: '',
    ReferenceDoc: '',
    Destination: ''
  });

  // ── Derived Flags ──
  const isPermanent = PERMANENT_CASES.has(caseForm.CaseType);
  const needsDestination = DESTINATION_CASES.has(caseForm.CaseType);

  // Female-only check for Maternity Leave
  const isSelectedFemale = normalizeGender(selectedEmployee?.Gender || selectedEmployee?.gender) === 'female';
  const availableLeaveTypes = LEAVE_TYPES.filter(type => {
    if (type === 'عطلة أمومة') {
      return isSelectedFemale;
    }
    return true;
  });

  // Ensure we have gender if preSelectedEmployee was passed without it
  useEffect(() => {
    if (isOpen && preSelectedEmployee) {
      const empId = preSelectedEmployee.id || preSelectedEmployee.Id;
      if (empId && !preSelectedEmployee.Gender && !preSelectedEmployee.gender) {
        EmployeeService.getById(empId)
          .then(res => {
            if (res?.success && res.data) {
              setSelectedEmployee(prev => ({
                ...prev,
                ...res.data,
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, preSelectedEmployee]);

  // If selected employee is not female, reset maternity leave if selected
  useEffect(() => {
    if (!isSelectedFemale && leaveForm.StateTypeOrReason === 'عطلة أمومة') {
      setLeaveForm(prev => ({
        ...prev,
        StateTypeOrReason: LEAVE_TYPES[0],
        DaysCount: 30,
      }));
    }
  }, [isSelectedFemale, leaveForm.StateTypeOrReason]);

  // ── Fetch employees for searchable dropdown (skip when pre-selected) ──
  // Debounced + min 2 chars + AbortController cancels stale in-flight requests.
  useEffect(() => {
    if (!isOpen || preSelectedEmployee) return;
    if (!searchQuery) {
      setEmployees([]);
      return;
    }
    const controller = new AbortController();
    const fetchEmployees = async () => {
      try {
        const res = await EmployeeService.search(searchQuery, {
          province: provinceFilter,
          directorate: directorateFilter,
          signal: controller.signal,
        });
        if (res.success) setEmployees(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return; // aborted
        console.error("Failed to load employees", err);
      }
    };
    fetchEmployees();
    return () => controller.abort();
  }, [isOpen, searchQuery, provinceFilter, directorateFilter, preSelectedEmployee]);

  // ── Auto-calc EndDate for leaves ──
  useEffect(() => {
    if (entryCategory !== 'leave') return;
    if (leaveForm.StartDate && leaveForm.DaysCount > 0) {
      const start = new Date(leaveForm.StartDate);
      start.setDate(start.getDate() + Number(leaveForm.DaysCount) - 1);
      const calc = start.toISOString().split('T')[0];
      setLeaveForm(prev => prev.EndDate !== calc ? { ...prev, EndDate: calc } : prev);
    }
  }, [leaveForm.StartDate, leaveForm.DaysCount, entryCategory]);

  // ── Clear EndDate/Destination when toggling permanent/destination case types ──
  useEffect(() => {
    if (isPermanent) {
      setCaseForm(prev => ({ ...prev, EndDate: '' }));
    }
    if (!needsDestination) {
      setCaseForm(prev => ({ ...prev, Destination: '' }));
    }
  }, [caseForm.CaseType]);

  // ── Reset on open ──
  useEffect(() => {
    if (isOpen) {
      setEntryCategory(defaultCategory);
      if (preSelectedEmployee) {
        setSelectedEmployee({
          Id: preSelectedEmployee.id || preSelectedEmployee.Id,
          Name: preSelectedEmployee.name || preSelectedEmployee.Name,
          LastName: preSelectedEmployee.lastName || preSelectedEmployee.LastName || '',
          Gender: preSelectedEmployee.gender || preSelectedEmployee.Gender || '',
          JobTitle: preSelectedEmployee.JobTitle,
        });
        setSearchTerm(formatEmployeeName(preSelectedEmployee));
      } else {
        setSelectedEmployee(null);
        setSearchTerm('');
      }
      setProvinceFilter('');
      setDirectorateFilter('');
      setIsDropdownOpen(false);
      setError('');
      setLeaveForm({
        StateTypeOrReason: LEAVE_TYPES[0],
        StartDate: new Date().toISOString().split('T')[0],
        DaysCount: 30,
        EndDate: '',
        Notes: '',
        DoctorName: '',
        CertificateDate: '',
        HasSecondCertificate: false,
        SecondDoctorName: '',
        SecondCertificateDate: '',
      });
      setCaseForm({
        CaseType: SPECIAL_CASE_TYPES[0],
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: '',
        ReferenceDoc: '',
        Destination: ''
      });
    }
  }, [isOpen, defaultCategory, preSelectedEmployee]);

  // ── Search handler (API call is debounced via useDebounce) ──
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };

  // ── Select employee ──
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm(`${formatEmployeeName(emp)} (${emp.Id})`);
    setIsDropdownOpen(false);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const empId = preSelectedEmployee?.id || selectedEmployee?.Id;
    if (!empId) {
      setError('الرجاء اختيار الموظف المعني');
      return;
    }

    setLoading(true);
    const employeeId = empId;

    try {
      if (entryCategory === 'leave') {
        const isMedicalLeave = leaveForm.StateTypeOrReason === 'عطلة مرضية' || leaveForm.StateTypeOrReason === 'عطلة أمومة';
        if (isMedicalLeave) {
          if (!leaveForm.DoctorName?.trim()) {
            setError('الرجاء إدخال الجهة المصدرة للشهادة الطبية');
            setLoading(false);
            return;
          }
          if (!leaveForm.CertificateDate) {
            setError('الرجاء إدخال تاريخ الشهادة الطبية');
            setLoading(false);
            return;
          }
          if (leaveForm.HasSecondCertificate && !leaveForm.SecondCertificateDate) {
            setError('الرجاء إدخال تاريخ الشهادة الطبية الثانية');
            setLoading(false);
            return;
          }
        }

        // Route → POST /api/employee-states
        const payload = {
          EmployeesId: employeeId,
          RecordCategory: 'تسجيل عطلة', // or 'عطلة'
          StateTypeOrReason: leaveForm.StateTypeOrReason,
          DaysCount: Number(leaveForm.DaysCount) || 0,
          RequestedDays: Number(leaveForm.DaysCount) || 0,
          StartDate: leaveForm.StartDate,
          EndDate: leaveForm.EndDate,
          Notes: leaveForm.Notes,
          IsResumed: false,
          ActualReturnDate: null,
          CurrentJobTitle: selectedEmployee?.JobTitle?.RankName || "",
          DoctorName: isMedicalLeave ? (leaveForm.DoctorName?.trim() || null) : null,
          doctorName: isMedicalLeave ? (leaveForm.DoctorName?.trim() || null) : null,
          CertificateDate: isMedicalLeave ? (leaveForm.CertificateDate || null) : null,
          certificateDate: isMedicalLeave ? (leaveForm.CertificateDate || null) : null,
          SecondDoctorName: isMedicalLeave && leaveForm.HasSecondCertificate
            ? (leaveForm.SecondDoctorName?.trim() || null)
            : null,
          secondDoctorName: isMedicalLeave && leaveForm.HasSecondCertificate
            ? (leaveForm.SecondDoctorName?.trim() || null)
            : null,
          SecondCertificateDate: isMedicalLeave && leaveForm.HasSecondCertificate
            ? (leaveForm.SecondCertificateDate || null)
            : null,
          secondCertificateDate: isMedicalLeave && leaveForm.HasSecondCertificate
            ? (leaveForm.SecondCertificateDate || null)
            : null,
        };
        await EmployeeStatesService.create(payload);
      } else {
        // Route → POST /api/employees/:id/special-cases
        const payload = {
          CaseType: caseForm.CaseType,
          StartDate: caseForm.StartDate,
          EndDate: isPermanent ? null : (caseForm.EndDate || null),
          ReferenceDoc: caseForm.ReferenceDoc,
          Destination: needsDestination ? (caseForm.Destination || null) : null,
          IsActive: true
        };
        await SpecialCasesService.create(employeeId, payload);
      }

      // Invalidate all related leaves, special cases, employee summaries, and dashboard widgets
      await refreshLeaves(employeeId);
      await refreshSpecialCases(employeeId);

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans" dir="rtl" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {entryCategory === 'leave' ? 'تسجيل عطلة جديدة' : 'تسجيل حالة خاصة جديدة'}
            </h2>
            <p className="text-xs text-slate-400">
              {entryCategory === 'leave' ? 'سنوية، مرضية، أمومة، استثنائية، بدون راتب' : 'حركة إدارية للموظف'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Category Tabs ── */}
        {!hideCategoryTabs && canLeaves && canSpecialCases && (
          <div className="flex border-b border-slate-100 px-6 bg-white">
            <button
              type="button"
              onClick={() => {
                if (entryCategory !== 'leave') {
                  setEntryCategory('leave');
                  if (!preSelectedEmployee) {
                    setSelectedEmployee(null);
                    setSearchTerm('');
                    setEmployees([]);
                    setIsDropdownOpen(false);
                  }
                  setError('');
                }
              }}
              className={`px-5 py-3 font-semibold text-xs border-b-2 outline-none transition-all ${
                entryCategory === 'leave'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Calendar size={14} />
                تسجيل عطلة
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (entryCategory !== 'special_case') {
                  setEntryCategory('special_case');
                  if (!preSelectedEmployee) {
                    setSelectedEmployee(null);
                    setSearchTerm('');
                    setEmployees([]);
                    setIsDropdownOpen(false);
                  }
                  setError('');
                }
              }}
              className={`px-5 py-3 font-semibold text-xs border-b-2 outline-none transition-all ${
                entryCategory === 'special_case'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <FileText size={14} />
                حالة خاصة
              </span>
            </button>
          </div>
        )}

        {/* ── Form Body ── */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-r-4 border-red-500 rounded-lg text-sm font-medium animate-[shake_0.3s_ease-in-out]">
              {error}
            </div>
          )}

          <form id="unifiedForm" onSubmit={handleSubmit} className="space-y-4">
            {/* ── Employee Search (hidden when pre-selected) ── */}
            {preSelectedEmployee ? (
              <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Check size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{preSelectedEmployee.name}</p>
                  <p className="text-xs text-slate-400">الموظف المعني</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  الموظف المعني <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={provinceFilter}
                    onChange={(e) => { setProvinceFilter(e.target.value); setDirectorateFilter(''); }}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  >
                    <option value="">الولاية: الكل</option>
                    {allowedProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <select
                    value={directorateFilter}
                    onChange={(e) => setDirectorateFilter(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!provinceFilter}
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
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    className="w-full h-10 pr-9 pl-4 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  />
                  {selectedEmployee && (
                    <div className="absolute left-3 top-2.5 flex items-center gap-1.5">
                      {selectedEmployee.EmployeeStatus === 'منقول' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-bold">
                          منقول
                        </span>
                      )}
                      {selectedEmployee.EmployeeStatus === 'منتدب' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-bold">
                          منتدب
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                        <Check size={12} />
                        محدد
                      </span>
                    </div>
                  )}

                  {isDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {employees.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">
                          {searchTerm.trim().length < MIN_SEARCH_CHARS ? 'اكتب حرفين على الأقل للبحث...' : 'لا توجد نتائج'}
                        </div>
                      ) : (
                        employees.map(emp => (
                          <div
                            key={emp.Id}
                            onClick={() => handleSelectEmployee(emp)}
                            className={`p-3 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${
                              selectedEmployee?.Id === emp.Id ? 'bg-emerald-50/60 text-emerald-700' : 'text-slate-700'
                            }`}
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
                            {selectedEmployee?.Id === emp.Id && <Check size={16} className="text-emerald-500" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                 LEAVE FIELDS
                ══════════════════════════════════════════════ */}
            {entryCategory === 'leave' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">نوع العطلة <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={leaveForm.StateTypeOrReason}
                    onChange={e => {
                      const newType = e.target.value;
                      setLeaveForm(prev => {
                        const isSwitchingToSick = newType === "عطلة مرضية" && prev.StateTypeOrReason !== "عطلة مرضية";
                        const isSwitchingToMaternity = newType === "عطلة أمومة" && prev.StateTypeOrReason !== "عطلة أمومة";
                        const isSwitchingToAnnual = newType === "عطلة سنوية" && prev.StateTypeOrReason !== "عطلة سنوية";
                        const needsCert = newType === "عطلة مرضية" || newType === "عطلة أمومة";

                        let newDaysCount = prev.DaysCount;
                        if (isSwitchingToMaternity) {
                          newDaysCount = 150;
                        } else if (isSwitchingToSick) {
                          newDaysCount = '';
                        } else if (isSwitchingToAnnual) {
                          newDaysCount = 30;
                        }

                        let calculatedEndDate = prev.EndDate;
                        if (isSwitchingToMaternity && prev.StartDate) {
                          const start = new Date(prev.StartDate);
                          start.setDate(start.getDate() + 150 - 1);
                          calculatedEndDate = start.toISOString().split('T')[0];
                        }

                        return {
                          ...prev,
                          StateTypeOrReason: newType,
                          DaysCount: newDaysCount,
                          EndDate: calculatedEndDate,
                          CertificateDate: needsCert && !prev.CertificateDate ? prev.StartDate : prev.CertificateDate,
                        };
                      });
                    }}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                  >
                    {availableLeaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* ── Conditional Medical Certificate Inputs (Sick & Maternity Leave) ── */}
                {(leaveForm.StateTypeOrReason === "عطلة مرضية" || leaveForm.StateTypeOrReason === "عطلة أمومة") && (
                  <div className="md:col-span-2 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>معلومات الشهادة الطبية الأولى</span>
                      <label className="flex items-center gap-2 cursor-pointer font-normal text-slate-600 hover:text-slate-900 select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(leaveForm.HasSecondCertificate)}
                          onChange={e => setLeaveForm(prev => ({
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
                          placeholder="مثال: د. أحمد بن علي أو المؤسسة العمومية الإستشفائية بالشرفة"
                          value={leaveForm.DoctorName || ''}
                          onChange={e => setLeaveForm(prev => ({ ...prev, DoctorName: e.target.value }))}
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
                          value={leaveForm.CertificateDate || ''}
                          onChange={e => setLeaveForm(prev => ({ ...prev, CertificateDate: e.target.value }))}
                          className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Optional Second Medical Certificate */}
                    {leaveForm.HasSecondCertificate && (
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
                              placeholder="مثال: BOUNEDJMA FATIHA أو عيادة النور"
                              value={leaveForm.SecondDoctorName || ''}
                              onChange={e => setLeaveForm(prev => ({ ...prev, SecondDoctorName: e.target.value }))}
                              className="w-full h-[42px] px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5 whitespace-nowrap">
                              تاريخ الشهادة الطبية الثانية <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required={leaveForm.HasSecondCertificate}
                              value={leaveForm.SecondCertificateDate || ''}
                              onChange={e => setLeaveForm(prev => ({ ...prev, SecondCertificateDate: e.target.value }))}
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
                    value={leaveForm.StartDate}
                    onChange={e => setLeaveForm(prev => ({ ...prev, StartDate: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">المدة (أيام) <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={leaveForm.DaysCount}
                    onChange={e => setLeaveForm(prev => ({ ...prev, DaysCount: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ النهاية المتوقع</label>
                  <input
                    type="date"
                    value={leaveForm.EndDate}
                    readOnly
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg outline-none bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">يتم حسابه تلقائياً بناءً على المدة</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات</label>
                  <input
                    type="text"
                    value={leaveForm.Notes}
                    onChange={e => setLeaveForm(prev => ({ ...prev, Notes: e.target.value }))}
                    placeholder="ملاحظات إضافية (اختياري)..."
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                  />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                 SPECIAL CASE FIELDS
                ══════════════════════════════════════════════ */}
            {entryCategory === 'special_case' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">نوع الحالة <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={caseForm.CaseType}
                    onChange={e => setCaseForm(prev => ({ ...prev, CaseType: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                  >
                    {SPECIAL_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ البداية <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="date"
                    value={caseForm.StartDate}
                    onChange={e => setCaseForm(prev => ({ ...prev, StartDate: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    المقرر <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute right-3 top-3 text-slate-400" size={16} />
                    <input
                      required
                      type="text"
                      value={caseForm.ReferenceDoc}
                      onChange={e => setCaseForm(prev => ({ ...prev, ReferenceDoc: e.target.value }))}
                      placeholder="رقم المقرر أو المرجع..."
                      className="w-full h-10 pr-9 pl-4 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                    />
                  </div>
                </div>

                {/* EndDate — hidden for permanent cases */}
                {!isPermanent && (
                  <div className="animate-[fadeIn_0.2s_ease-out]">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={caseForm.EndDate}
                      onChange={e => setCaseForm(prev => ({ ...prev, EndDate: e.target.value }))}
                      className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Destination — only for انتداب, تحويل, نقل */}
                {needsDestination && (
                  <div className="animate-[fadeIn_0.2s_ease-out]">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      الوجهة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-3 text-slate-400" size={16} />
                      <input
                        required
                        type="text"
                        value={caseForm.Destination}
                        onChange={e => setCaseForm(prev => ({ ...prev, Destination: e.target.value }))}
                        placeholder="الجهة أو المؤسسة المستقبلة..."
                        className="w-full h-10 pr-9 pl-4 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Permanent case info badge */}
                {isPermanent && (
                  <div className="md:col-span-2 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                      حالة دائمة — لا تتطلب تاريخ نهاية
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-white gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="unifiedForm"
            disabled={loading}
            className="flex items-center justify-center gap-2 h-10 px-6 text-white rounded-lg transition-all font-medium text-sm disabled:opacity-70 hover:opacity-90 active:scale-[0.98] shadow-xs"
            style={{ backgroundColor: '#105b38' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              entryCategory === 'leave' ? 'تسجيل العطلة' : 'تسجيل الحالة'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedEntryModal;
