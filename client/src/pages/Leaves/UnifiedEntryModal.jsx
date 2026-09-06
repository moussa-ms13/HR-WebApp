import React, { useState, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { X, Loader2, Calendar, Search, Check, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import EmployeeStatesService from '../../services/employeeStatesService';
import SpecialCasesService from '../../services/specialCasesService';
import EmployeeService from '../../services/employeeService';

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
const UnifiedEntryModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const allowedProvinces = getAllowedProvinces(user);

  // ── Core State ──
  const [entryCategory, setEntryCategory] = useState('leave');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Employee Search State ──
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const debounceRef = useRef(null);

  // ── Leave Fields ──
  const [leaveForm, setLeaveForm] = useState({
    StateTypeOrReason: LEAVE_TYPES[0],
    StartDate: new Date().toISOString().split('T')[0],
    DaysCount: 30,
    EndDate: '',
    Notes: ''
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

  // ── Fetch employees for searchable dropdown ──
  useEffect(() => {
    if (!isOpen) return;
    const fetchEmployees = async () => {
      try {
        const res = await EmployeeService.getAll(1, 50, searchQuery, provinceFilter, directorateFilter, '');
        if (res.success) setEmployees(res.data);
      } catch (err) {
        console.error("Failed to load employees", err);
      }
    };
    fetchEmployees();
  }, [isOpen, searchQuery, provinceFilter, directorateFilter]);

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
      setEntryCategory('leave');
      setSelectedEmployee(null);
      setSearchTerm('');
      setSearchQuery('');
      setProvinceFilter('');
      setDirectorateFilter('');
      setIsDropdownOpen(false);
      setError('');
      setLeaveForm({
        StateTypeOrReason: LEAVE_TYPES[0],
        StartDate: new Date().toISOString().split('T')[0],
        DaysCount: 30,
        EndDate: '',
        Notes: ''
      });
      setCaseForm({
        CaseType: SPECIAL_CASE_TYPES[0],
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: '',
        ReferenceDoc: '',
        Destination: ''
      });
    }
  }, [isOpen]);

  // ── Search handler with debounce ──
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsDropdownOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(value.trim()), 300);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ── Select employee ──
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm(`${emp.Name} ${emp.LastName} (${emp.Id})`);
    setIsDropdownOpen(false);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedEmployee) {
      setError('الرجاء اختيار الموظف المعني');
      return;
    }

    setLoading(true);
    const employeeId = selectedEmployee.Id;

    try {
      if (entryCategory === 'leave') {
        // Route → POST /api/employee-states
        const payload = {
          EmployeesId: employeeId,
          RecordCategory: 'تسجيل عطلة',
          StateTypeOrReason: leaveForm.StateTypeOrReason,
          DaysCount: Number(leaveForm.DaysCount),
          StartDate: leaveForm.StartDate,
          EndDate: leaveForm.EndDate,
          IsResumed: false,
          ActualReturnDate: null,
          CurrentJobTitle: selectedEmployee.JobTitle?.RankName || ""
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

      // ── SWR Cache Invalidation ──
      // 1. Invalidate the global employee-states list (any matching key)
      mutate(
        key => Array.isArray(key) && key[0] === '/api/employee-states',
        undefined,
        { revalidate: true }
      );
      // 2. Invalidate the specific employee's profile cache
      mutate(`/api/employees/${employeeId}`);
      // 3. Invalidate special-cases list for this employee
      mutate(`/api/employees/${employeeId}/special-cases`);

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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-l from-emerald-50 to-white">
          <div className="flex items-center gap-3 text-slate-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Calendar size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold">إضافة حالة جديدة</h2>
              <p className="text-xs text-slate-500">عطلة أو حالة خاصة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* ── Category Tabs ── */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setEntryCategory('leave')}
            className={`px-6 py-3.5 font-medium text-sm border-b-2 outline-none transition-all ${
              entryCategory === 'leave'
                ? 'border-emerald-600 text-emerald-700 bg-white/80'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar size={15} />
              تسجيل عطلة
            </span>
          </button>
          <button
            type="button"
            onClick={() => setEntryCategory('special_case')}
            className={`px-6 py-3.5 font-medium text-sm border-b-2 outline-none transition-all ${
              entryCategory === 'special_case'
                ? 'border-emerald-600 text-emerald-700 bg-white/80'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText size={15} />
              حالة خاصة
            </span>
          </button>
        </div>

        {/* ── Form Body ── */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-r-4 border-red-500 rounded-lg text-sm font-medium animate-[shake_0.3s_ease-in-out]">
              {error}
            </div>
          )}

          <form id="unifiedForm" onSubmit={handleSubmit} className="space-y-5">
            {/* ── Employee Search ── */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">الموظف المعني <span className="text-red-500">*</span></label>
              <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={provinceFilter}
                    onChange={(e) => { setProvinceFilter(e.target.value); setDirectorateFilter(''); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-400 outline-none"
                  >
                    <option value="">الولاية: الكل</option>
                    {allowedProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <select
                    value={directorateFilter}
                    onChange={(e) => setDirectorateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-400 outline-none"
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
                  <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو اللقب أو الرقم..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-400 outline-none bg-white"
                  />
                  {selectedEmployee && (
                    <div className="absolute left-3 top-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <Check size={12} />
                        محدد
                      </span>
                    </div>
                  )}

                  {isDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {employees.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">لا توجد نتائج</div>
                      ) : (
                        employees.map(emp => (
                          <div
                            key={emp.Id}
                            onClick={() => handleSelectEmployee(emp)}
                            className={`p-3 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${
                              selectedEmployee?.Id === emp.Id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="font-bold">{emp.Name} {emp.LastName}</span>
                              <span className="text-gray-500 mr-2 text-xs"> ({emp.Id})</span>
                              <div className="text-xs text-gray-400 mt-0.5">{emp.Province} - {emp.Directorate || emp.Department || 'الإدارة العامة'}</div>
                            </div>
                            {selectedEmployee?.Id === emp.Id && <Check size={16} className="text-emerald-500" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════
                 LEAVE FIELDS
                ══════════════════════════════════════════════ */}
            {entryCategory === 'leave' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-[fadeIn_0.2s_ease-out]">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">نوع العطلة <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={leaveForm.StateTypeOrReason}
                    onChange={e => setLeaveForm(prev => ({ ...prev, StateTypeOrReason: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400 transition-colors"
                  >
                    {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ البداية <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="date"
                    value={leaveForm.StartDate}
                    onChange={e => setLeaveForm(prev => ({ ...prev, StartDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">المدة (أيام) <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={leaveForm.DaysCount}
                    onChange={e => setLeaveForm(prev => ({ ...prev, DaysCount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ النهاية المتوقع</label>
                  <input
                    type="date"
                    value={leaveForm.EndDate}
                    readOnly
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-200 text-slate-600"
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-400 mt-1">يتم حسابه تلقائياً</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">ملاحظات</label>
                  <input
                    type="text"
                    value={leaveForm.Notes}
                    onChange={e => setLeaveForm(prev => ({ ...prev, Notes: e.target.value }))}
                    placeholder="ملاحظات إضافية (اختياري)..."
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                 SPECIAL CASE FIELDS
                ══════════════════════════════════════════════ */}
            {entryCategory === 'special_case' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-[fadeIn_0.2s_ease-out]">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">نوع الحالة <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={caseForm.CaseType}
                    onChange={e => setCaseForm(prev => ({ ...prev, CaseType: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400 transition-colors"
                  >
                    {SPECIAL_CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ البداية <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="date"
                    value={caseForm.StartDate}
                    onChange={e => setCaseForm(prev => ({ ...prev, StartDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    المقرر <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute right-3 top-2.5 text-slate-400" size={16} />
                    <input
                      required
                      type="text"
                      value={caseForm.ReferenceDoc}
                      onChange={e => setCaseForm(prev => ({ ...prev, ReferenceDoc: e.target.value }))}
                      placeholder="رقم المقرر أو المرجع..."
                      className="w-full pr-10 pl-4 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* EndDate — hidden for permanent cases */}
                {!isPermanent && (
                  <div className="animate-[fadeIn_0.2s_ease-out]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={caseForm.EndDate}
                      onChange={e => setCaseForm(prev => ({ ...prev, EndDate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                      dir="ltr"
                    />
                  </div>
                )}

                {/* Destination — only for انتداب, تحويل, نقل */}
                {needsDestination && (
                  <div className="animate-[fadeIn_0.2s_ease-out]">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      الوجهة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-2.5 text-slate-400" size={16} />
                      <input
                        required
                        type="text"
                        value={caseForm.Destination}
                        onChange={e => setCaseForm(prev => ({ ...prev, Destination: e.target.value }))}
                        placeholder="الجهة أو المؤسسة المستقبلة..."
                        className="w-full pr-10 pl-4 py-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                )}

                {/* Permanent case info badge */}
                {isPermanent && (
                  <div className="md:col-span-2 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      حالة نهائية — لا يتطلب تاريخ نهاية
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-white transition-colors font-medium text-sm shadow-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="unifiedForm"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-8 py-2.5 text-white rounded-lg transition-all font-medium shadow-sm text-sm disabled:opacity-70 hover:shadow-md active:scale-[0.98]"
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
