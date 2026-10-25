import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowRightLeft, Search, Check, MapPin, FileText, User } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../../utils/constants';
import useDebounce from '../../../hooks/useDebounce';
import SpecialCasesService from '../../../services/specialCasesService';
import EmployeeService from '../../../services/employeeService';
import { refreshSpecialCases, refreshEmployees } from '../../../utils/cacheManager';
import { useToast } from '../../../components/ui/Toast';
import { formatEmployeeName } from '../../../utils/employeeUtils';
import {
  ALL_SPECIAL_CASE_TYPES,
  isPermanentExit,
} from '../../../utils/specialCasesConstants';

const MIN_SEARCH_CHARS = 2;

export const SPECIAL_CASE_TYPES = ALL_SPECIAL_CASE_TYPES;

const DESTINATION_CASES = new Set(['انتداب', 'تحويل', 'نقل']);

export default function SpecialCaseModal({
  isOpen,
  onClose,
  onSuccess,
  record = null,
  preSelectedEmployee = null,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const allowedProvinces = getAllowedProvinces(user);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Employee Search State (Add Mode) ──
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const searchQuery = debouncedSearchTerm.trim().length >= MIN_SEARCH_CHARS ? debouncedSearchTerm.trim() : '';

  // ── Form State ──
  const [form, setForm] = useState({
    CaseType: SPECIAL_CASE_TYPES[0],
    StartDate: new Date().toISOString().split('T')[0],
    EndDate: '',
    ReferenceDoc: '',
    Destination: '',
    IsActive: true,
  });

  const isPermanent = isPermanentExit(form.CaseType);
  const needsDestination = DESTINATION_CASES.has(form.CaseType);

  // Initialize or reset form on open/record change
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setLoading(false);

    if (record) {
      // Edit Mode
      setForm({
        CaseType: record.CaseType || SPECIAL_CASE_TYPES[0],
        StartDate: record.StartDate ? record.StartDate.split('T')[0] : new Date().toISOString().split('T')[0],
        EndDate: record.EndDate ? record.EndDate.split('T')[0] : '',
        ReferenceDoc: record.ReferenceDoc || '',
        Destination: record.Destination || '',
        IsActive: record.IsActive !== undefined ? record.IsActive : true,
      });

      // Employee display in Edit Mode
      if (record.Employee) {
        setSelectedEmployee({
          Id: record.EmployeesId || record.EmployeeId,
          Name: record.Employee.Name,
          LastName: record.Employee.LastName,
          Province: record.Employee.Province,
        });
      }
    } else {
      // Add Mode
      setForm({
        CaseType: SPECIAL_CASE_TYPES[0],
        StartDate: new Date().toISOString().split('T')[0],
        EndDate: '',
        ReferenceDoc: '',
        Destination: '',
        IsActive: true,
      });

      if (preSelectedEmployee) {
        setSelectedEmployee(preSelectedEmployee);
      } else {
        setSelectedEmployee(null);
        setSearchTerm('');
        setEmployees([]);
        setProvinceFilter('');
        setDirectorateFilter('');
        setIsDropdownOpen(false);
      }
    }
  }, [isOpen, record, preSelectedEmployee]);

  // Search employees in Add mode
  useEffect(() => {
    if (!isOpen || record || preSelectedEmployee) return;
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
        if (res.success) {
          setEmployees(res.data);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && err.name !== 'CanceledError') {
          console.error('Failed to search employees', err);
        }
      }
    };

    fetchEmployees();
    return () => controller.abort();
  }, [isOpen, record, preSelectedEmployee, searchQuery, provinceFilter, directorateFilter]);

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setSearchTerm(`${formatEmployeeName(emp)} (${emp.Id})`);
    setIsDropdownOpen(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const targetEmployeeId = record
      ? (record.EmployeesId || record.EmployeeId || selectedEmployee?.Id)
      : selectedEmployee?.Id;

    if (!targetEmployeeId) {
      setError('يرجى تحديد الموظف المعني أولاً');
      return;
    }

    if (!form.CaseType) {
      setError('يرجى تحديد نوع الحالة');
      return;
    }

    if (!form.StartDate) {
      setError('يرجى تحديد تاريخ السريان');
      return;
    }

    if (!form.ReferenceDoc?.trim()) {
      setError('يرجى إدخال رقم وتاريخ المقرر / القرار');
      return;
    }

    if (needsDestination && !form.Destination?.trim()) {
      setError('يرجى إدخال الوجهة / مقر العمل الجديد');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        CaseType: form.CaseType,
        StartDate: form.StartDate,
        EndDate: isPermanent ? null : (form.EndDate || null),
        ReferenceDoc: form.ReferenceDoc.trim(),
        Destination: needsDestination ? form.Destination.trim() : null,
        IsActive: form.IsActive,
      };

      if (record) {
        await SpecialCasesService.update(targetEmployeeId, record.Id, payload);
        toast.success('تم تعديل الحالة الخاصة بنجاح');
      } else {
        await SpecialCasesService.create(targetEmployeeId, payload);
        toast.success('تم تسجيل الحالة الخاصة بنجاح');
      }

      await refreshSpecialCases(targetEmployeeId);
      await refreshEmployees(targetEmployeeId);

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ الحالة الخاصة');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-sans"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[scaleIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {record ? 'تعديل الحالة الخاصة' : 'تسجيل حالة خاصة جديدة'}
              </h2>
              <p className="text-xs text-gray-500">
                الحركات الإدارية (انتداب، تحويل، نقل، استيداع، إلخ)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border-r-4 border-red-500 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form id="specialCaseForm" onSubmit={handleSubmit} className="space-y-5">
            {/* ── Employee Section ── */}
            {record || preSelectedEmployee ? (
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {formatEmployeeName(selectedEmployee)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedEmployee?.Province ? `ولاية ${selectedEmployee.Province}` : 'الموظف المعني'}
                      {selectedEmployee?.Id ? ` • المعرّف: #${selectedEmployee.Id}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                  تم تحديد الموظف
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  الموظف المعني <span className="text-red-500">*</span>
                </label>

                {/* Filter selects for easy scope */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={provinceFilter}
                    onChange={(e) => {
                      setProvinceFilter(e.target.value);
                      setDirectorateFilter('');
                    }}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  >
                    <option value="">الولاية: الكل</option>
                    {allowedProvinces.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <select
                    value={directorateFilter}
                    onChange={(e) => setDirectorateFilter(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!provinceFilter}
                  >
                    <option value="">الجهة: الكل</option>
                    {provinceFilter === 'الشلف' && (
                      <option value="المديرية الجهوية للأملاك الوطنية" className="font-bold text-emerald-700">
                        المديرية الجهوية للأملاك الوطنية
                      </option>
                    )}
                    <option value="مديرية أملاك الدولة" className="font-bold">
                      مديرية أملاك الدولة
                    </option>
                    {availableMofatishiyat.map((item) => (
                      <option key={item} value={item}>
                        -- {item}
                      </option>
                    ))}
                    <option value="مديرية مسح الأراضي والحفظ العقاري" className="font-bold">
                      مديرية مسح الأراضي
                    </option>
                    {availableMohafathat.map((item) => (
                      <option key={item} value={item}>
                        -- {item}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Autocomplete Input */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، اللقب، أو رقم التعريف (حرفين على الأقل)..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setSelectedEmployee(null);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (employees.length > 0) setIsDropdownOpen(true);
                      }}
                      className="w-full h-10 pr-10 pl-24 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-colors"
                    />
                    {selectedEmployee && (
                      <div className="absolute left-3 top-2 flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium">
                        <Check size={13} />
                        تم التحديد
                      </div>
                    )}
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-30 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto">
                      {employees.length === 0 ? (
                        <div className="p-3 text-sm text-slate-400 text-center">
                          {searchTerm.trim().length < MIN_SEARCH_CHARS
                            ? 'اكتب حرفين على الأقل للبحث...'
                            : 'لا توجد نتائج مطابقة'}
                        </div>
                      ) : (
                        employees.map((emp) => (
                          <div
                            key={emp.Id}
                            onClick={() => handleSelectEmployee(emp)}
                            className={`p-3 text-sm cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition-colors ${
                              selectedEmployee?.Id === emp.Id ? 'bg-emerald-50/70 text-emerald-700' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold">
                                  {formatEmployeeName(emp)}
                                </span>
                                <span className="text-slate-400 text-xs">({emp.Id})</span>
                                {emp.EmployeeStatus && (
                                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                                    {emp.EmployeeStatus}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {emp.Province} - {emp.Directorate || 'الإدارة العامة'}
                              </div>
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

            {/* ── Movement Details ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  نوع الحالة / الحركة الإدارية <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.CaseType}
                  onChange={(e) => setForm((prev) => ({ ...prev, CaseType: e.target.value }))}
                  className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                >
                  {SPECIAL_CASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  تاريخ السريان / البداية <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={form.StartDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, StartDate: e.target.value }))}
                  className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                  dir="ltr"
                />
              </div>

              {/* End Date (hidden for permanent movements) */}
              {!isPermanent ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    تاريخ النهاية <span className="text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <input
                    type="date"
                    value={form.EndDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, EndDate: e.target.value }))}
                    className="w-full h-10 px-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                    dir="ltr"
                  />
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="w-full p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    قرار نهائي (خروج نهائي) — لا يتطلب تاريخ نهاية
                  </div>
                </div>
              )}

              {/* Destination (for secondment/transfer/relocation) */}
              {needsDestination && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    الوجهة / مقر العمل الجديد <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-2.5 text-slate-400" size={17} />
                    <input
                      required
                      type="text"
                      value={form.Destination}
                      onChange={(e) => setForm((prev) => ({ ...prev, Destination: e.target.value }))}
                      placeholder="مثال: وزارة المالية / مديرية الضرائب لولاية الشلف..."
                      className="w-full h-10 pr-9 pl-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Reference Doc / Decision */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  رقم وتاريخ المقرر / القرار <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute right-3 top-2.5 text-slate-400" size={17} />
                  <input
                    required
                    type="text"
                    value={form.ReferenceDoc}
                    onChange={(e) => setForm((prev) => ({ ...prev, ReferenceDoc: e.target.value }))}
                    placeholder="مثال: مقرر رقم 145/2026 بتاريخ 2026/02/01..."
                    className="w-full h-10 pr-9 pl-3 border border-slate-200 hover:border-slate-300 rounded-lg outline-none bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-colors"
                  />
                </div>
              </div>

              {/* IsActive Status */}
              <div className="md:col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-700 block">حالة السريان</span>
                  <span className="text-xs text-slate-400">تحديد ما إذا كانت الحالة نشطة وسارية المفعول حالياً</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.IsActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, IsActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-100 bg-white gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="specialCaseForm"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{record ? 'حفظ التعديلات' : 'تسجيل الحالة الخاصة'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
