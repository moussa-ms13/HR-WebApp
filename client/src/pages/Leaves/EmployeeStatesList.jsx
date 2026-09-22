import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import useSWR from 'swr';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllowedProvinces, getMofatishiyat, getMohafathat } from '../../utils/constants';
import useDebounce from '../../hooks/useDebounce';
import EmployeeStatesService from '../../services/employeeStatesService';
import SpecialCasesService from '../../services/specialCasesService';
import EmployeeStateModal from './EmployeeStateModal';
import UnifiedEntryModal from './UnifiedEntryModal';
import LeavePrintDocument from '../../components/Leaves/LeavePrintDocument';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import { refreshLeaves, refreshSpecialCases, refreshEmployees } from '../../utils/cacheManager';
import { Search, MoreVertical, CalendarOff, ArrowUpDown, ChevronDown, Loader2, Trash2, Plus, Printer } from 'lucide-react';
import { DateText } from '../../utils/formatDate';
import {
  normalizeCorpsType,
  normalizeGender,
  getGenderProfile,
  numberToArabicWords,
  formatDateSafe,
  generateReferenceCode,
  buildQrPayload,
} from '../../utils/leaveCertificateConfig';

const fetcher = async ([url, page, limit, category, search, directorate, province]) => {
  const result = await EmployeeStatesService.getAll(page, limit, category, search, directorate, province);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

const casesFetcher = async ([url, page, limit, search, directorate, province]) => {
  const result = await SpecialCasesService.getAll(page, limit, search, province, directorate);
  if (!result.success) throw new Error("Failed to fetch");
  return result;
};

// ─── Build normalized print data from a raw employee-state record ────
function buildPrintDataFromState(st) {
  const emp = st.Employee || {};
  const warnings = [];

  // Normalize corps type
  const corpsType = normalizeCorpsType(emp);
  if (corpsType === "unknown") {
    warnings.push("لم يتم تحديد نوع السلك (مشترك/خاص). تم استخدام الأسلاك المشتركة كقيمة افتراضية.");
  }

  // Normalize gender
  const gender = normalizeGender(emp.Gender);
  if (!gender) {
    warnings.push("جنس الموظف غير محدد أو غير صالح. تم استخدام صيغة المذكر كقيمة افتراضية. يرجى تصحيح بيانات الموظف.");
  }
  const genderProfile = getGenderProfile(gender || "male");

  // Employee name
  const fullName = `${emp.Name || ""} ${emp.LastName || ""}`.trim();

  // Rank (from JobTitle relation)
  const rank = emp.JobTitle?.RankName || st.CurrentJobTitle || "";

  // Leave year — derive from StartDate
  const startYear = st.StartDate ? new Date(st.StartDate).getFullYear() : new Date().getFullYear();
  const leaveYear = String(startYear);

  // Days in words
  const days = st.DaysCount || 0;
  const daysInWords = numberToArabicWords(days);

  // Dates (timezone-safe)
  const startDate = formatDateSafe(st.StartDate);
  const endDate = formatDateSafe(st.EndDate);
  const resumeDate = formatDateSafe(st.ResumptionDate || st.ActualReturnDate || st.EndDate);
  const dateOfBirth = formatDateSafe(emp.DateOfBirth);

  // Reference code
  const refCode = generateReferenceCode(emp.Name, emp.LastName, emp.DateOfBirth, st.StartDate);

  // QR payload (offline informational)
  const qrPayload = buildQrPayload({
    referenceCode: refCode,
    employeeName: fullName,
    dateOfBirth,
    startDate,
    endDate,
    resumeDate,
    rank,
    jobTitle: emp.AssignedPosition || "/",
    province: emp.Province || "الشلف",
    leaveYear,
  });

  // Remaining balance — prefer rich multi-year breakdown (_remainingBreakdown) injected
  // by the FIFO engine on new records; fall back to the legacy scalar for old records.
  const remaining = (Array.isArray(st._remainingBreakdown) && st._remainingBreakdown.length > 0)
    ? st._remainingBreakdown.map((r) => ({
        year: String(r.year),
        days: r.days,
        daysInWords: numberToArabicWords(r.days),
      }))
    : st.RemainingBalanceAfter != null
      ? [{
          year: leaveYear,
          days: st.RemainingBalanceAfter,
          daysInWords: numberToArabicWords(st.RemainingBalanceAfter),
        }]
      : [];

  // Signature date = today
  const today = new Date();
  const sigDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return {
    corpsType: corpsType === "unknown" ? "common" : corpsType,
    genderProfile,
    header: {
      wilaya: emp.Province || "الشلف",
      subDirectorate: "الإدارة العامة",
      referenceNumber: "",
    },
    employee: {
      name: fullName,
      gender: gender || "male",
      dateOfBirth,
      rank,
      jobTitle: emp.AssignedPosition || "",
      province: emp.Province || "الشلف",
    },
    decision: {
      directorateName: `المديرية الجهوية للأملاك الوطنية ناحية ${emp.Province || "الشلف"}`,
    },
    leave: {
      year: leaveYear,
      days,
      daysInWords,
      startDate,
      endDate,
      resumeDate,
      remaining,
      notes: st.Notes,
    },
    signature: {
      place: "الشلف",
      date: sigDate,
    },
    qrPayload,
    referenceCode: refCode,
    warnings,
  };
}

// ─── Print certificate in isolated iframe ────────────────────
function printLeaveInIframe(printData) {
  return new Promise((resolve) => {
    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Write the base HTML structure
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>سند عطلة سنوية</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { direction: rtl; background: white; }
    @page { size: A4; margin: 5mm 15mm 15mm 15mm; }
  </style>
</head>
<body>
  <div id="print-root"></div>
</body>
</html>`);
    iframeDoc.close();

    // Render the React component into the iframe
    const mountPoint = iframeDoc.getElementById("print-root");
    const root = createRoot(mountPoint);
    root.render(
      React.createElement(LeavePrintDocument, printData)
    );

    // Wait for fonts and rendering, then print
    const attemptPrint = () => {
      // Check if QR SVG is rendered
      const qrSvg = iframeDoc.querySelector("svg");
      const pageContent = iframeDoc.querySelector(".leave-doc-page");

      if (!pageContent) {
        setTimeout(attemptPrint, 100);
        return;
      }

      // Wait a bit for fonts to load
      const printNow = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Print failed:", e);
        }

        // Cleanup after print dialog closes
        const cleanup = () => {
          try {
            root.unmount();
          } catch (_) {}
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        };

        // Listen for afterprint, or fallback timeout
        try {
          iframe.contentWindow.addEventListener("afterprint", cleanup, { once: true });
        } catch (_) {}
        // Fallback cleanup after 60 seconds
        setTimeout(cleanup, 60000);
      };

      // Give fonts 500ms to load
      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        iframeDoc.fonts.ready.then(() => setTimeout(printNow, 200));
      } else {
        setTimeout(printNow, 700);
      }
    };

    // Start checking after initial render
    setTimeout(attemptPrint, 300);
  });
}

const EmployeeStatesList = () => {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [provinceFilter, setProvinceFilter] = useState('');
  const [directorateFilter, setDirectorateFilter] = useState('');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search')?.trim() || '');
  const [activeTab, setActiveTab] = useState('leaves'); // 'leaves' | 'cases'

  const allowedProvinces = getAllowedProvinces(useAuth().user);
  const availableMofatishiyat = provinceFilter ? getMofatishiyat(provinceFilter) : [];
  const availableMohafathat = provinceFilter ? getMohafathat(provinceFilter) : [];

  // SWR keys are bound ONLY to the debounced value; API search fires from 2+ chars
  const debouncedSearch = useDebounce(searchInput, 500);
  const search = debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : '';

  const { data, error, isLoading, mutate } = useSWR(
    activeTab === 'leaves' ? ['/api/employee-states', page, limit, '', search, directorateFilter, provinceFilter] : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const { data: casesData, isLoading: isCasesLoading, mutate: mutateCases } = useSWR(
    activeTab === 'cases' ? ['/api/special-cases', page, limit, search, directorateFilter, provinceFilter] : null,
    casesFetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const states = Array.isArray(data) ? data : (data?.records || data?.data || []);
  const leavesMeta = data?.meta || { total: 0, totalPages: 0, page: 1 };
  const specialCases = Array.isArray(casesData) ? casesData : (casesData?.records || casesData?.data || []);
  const casesMeta = casesData?.meta || { total: 0, totalPages: 0, page: 1 };
  const meta = activeTab === 'leaves' ? leavesMeta : casesMeta;
  const showLeavesLoading = isLoading && !data;
  const showCasesLoading = isCasesLoading && !casesData;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const toast = useToast();

  // Delete confirm state
  const [confirmState, setConfirmState] = useState({ open: false, stateId: null, stateName: '', employeeId: null });

  const handleDelete = (st) => {
    setMenuOpenId(null);
    setConfirmState({ 
      open: true, 
      stateId: st.Id, 
      stateName: st.StateTypeOrReason || st.CaseType || '', 
      employeeId: st.EmployeesId || st.EmployeeId 
    });
  };

  const confirmDelete = async () => {
    const { stateId, employeeId } = confirmState;
    setConfirmState({ open: false, stateId: null, stateName: '', employeeId: null });
    try {
      if (activeTab === 'cases') {
        if (!employeeId) throw new Error("رقم الموظف غير متوفر");
        await SpecialCasesService.delete(employeeId, stateId);
        await refreshSpecialCases(employeeId);
        await refreshEmployees(employeeId);
        mutateCases();
        toast.success('تم حذف الحالة الخاصة بنجاح');
      } else {
        await EmployeeStatesService.delete(stateId);
        await refreshLeaves();
        await refreshEmployees();
        mutate();
        toast.success('تم حذف السجل بنجاح');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleAdd = () => {
    setIsUnifiedModalOpen(true);
  };

  const handleUnifiedSuccess = async () => {
    await refreshLeaves();
    await refreshSpecialCases();
    await refreshEmployees();
    mutate();
    mutateCases();
    toast.success('تمت الإضافة بنجاح');
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    await refreshLeaves();
    await refreshSpecialCases();
    mutate();
  };

  // ── Isolated Iframe Print Handler ──
  const handlePrint = useCallback((st) => {
    setMenuOpenId(null);
    const printData = buildPrintDataFromState(st);
    printLeaveInIframe(printData);
  }, []);

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

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-3 rounded-xl border border-gray-200">

        <div className="flex items-center gap-3">

          <select
            value={provinceFilter}
            onChange={(e) => { setProvinceFilter(e.target.value); setDirectorateFilter(''); setPage(1); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none"
          >
            <option value="">الولاية: الكل</option>
            {allowedProvinces.map(prov => (
              <option key={prov} value={prov}>{prov}</option>
            ))}
          </select>
          <ChevronDown size={14} className="-mr-6 text-gray-500 pointer-events-none" />

          <div className="h-4 w-px bg-gray-200 ml-2"></div>

          <select
            value={directorateFilter}
            onChange={(e) => { setDirectorateFilter(e.target.value); setPage(1); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none"
          >
            <option value="">الجهة: الكل</option>
            {provinceFilter === 'الشلف' && (
              <option value="المديرية الجهوية للأملاك الوطنية" className="font-bold text-emerald-700 bg-emerald-50">المديرية الجهوية للأملاك الوطنية</option>
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
          <ChevronDown size={14} className="-mr-6 text-gray-500 pointer-events-none" />

          <div className="h-4 w-px bg-gray-200 ml-2"></div>

          <div className="relative w-64">
            <input
              type="text"
              placeholder="البحث باسم الموظف..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasPermission('checkBoxAdd') && (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-5 py-2 text-white rounded-lg transition-all font-medium shadow-sm text-sm hover:shadow-md active:scale-[0.97]"
              style={{ backgroundColor: '#10b981' }}
            >
              <Plus size={16} />
              إضافة حالة
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-200 mb-4 w-fit">
        <button
          onClick={() => { setActiveTab('leaves'); setPage(1); }}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'leaves' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          العطل ({leavesMeta.total})
        </button>
        <button
          onClick={() => { setActiveTab('cases'); setPage(1); }}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cases' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          الحالات الخاصة ({casesMeta.total})
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col">
        {activeTab === 'leaves' ? (
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
              {showLeavesLoading ? (
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
                        {st?.Employee?.Name || 'غير محدد'} {st?.Employee?.LastName || ''}
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
                            className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {menuOpenId === st.Id && (
                            <div className="absolute left-0 mt-2 w-40 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedState(st); setIsModalOpen(true); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  تعديل السجل
                                </button>
                                {(st.RecordCategory?.includes('عطلة') || st.StateTypeOrReason === 'سنوية') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handlePrint(st); }}
                                    className="w-full text-right px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                    <Printer size={14} />
                                    طباعة السند
                                  </button>
                                )}
                                {hasPermission('checkBoxDelete') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(st); }}
                                    className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 size={14} />
                                    حذف
                                  </button>
                                )}
                              </div>
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
        ) : (
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <HeaderCell label="الموظف" />
                <HeaderCell label="نوع الحالة" />
                <HeaderCell label="تاريخ البداية" />
                <HeaderCell label="تاريخ النهاية" />
                <HeaderCell label="الوجهة" />
                <HeaderCell label="المقرر" />
                <HeaderCell label="الحالة" />
                <th className="py-4 px-4 font-medium text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {showCasesLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : specialCases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <CalendarOff size={32} className="mx-auto text-gray-300 mb-2" />
                    لا توجد حالات خاصة لعرضها
                  </td>
                </tr>
              ) : (
                specialCases.map((c) => {
                  const status = getRowStatus(c.EndDate, !c.IsActive);
                  return (
                    <tr key={c.Id} className={`${getRowBgStyles(status)} transition-colors group`}>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {c?.Employee?.Name || 'غير محدد'} {c?.Employee?.LastName || ''}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[150px] truncate" title={c?.CaseType}>
                        {c?.CaseType || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        <DateText value={c?.StartDate} />
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        {c?.EndDate ? <DateText value={c?.EndDate} /> : <span className="text-amber-600 font-medium">دائمة</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[150px] truncate" title={c?.Destination}>
                        {c?.Destination || '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-medium max-w-[150px] truncate" title={c?.ReferenceDoc}>
                        {c?.ReferenceDoc || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ${getStatusStyles(status)}`}>
                          {!c.IsActive ? 'غير نشطة' : getStatusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="relative inline-block text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === c.Id ? null : c.Id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {menuOpenId === c.Id && (
                            <div className="absolute left-0 mt-2 w-40 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                              <div className="py-1" role="menu">
                                <button
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedState(c); 
                                    setIsUnifiedModalOpen(true); 
                                    setMenuOpenId(null); 
                                  }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  تعديل الحالة الخاصة
                                </button>
                                {hasPermission('checkBoxDelete') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                                    className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 size={14} />
                                    حذف
                                  </button>
                                )}
                              </div>
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
        )}

        <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages || meta.totalPages === 0}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              التالي
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {meta.page}
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              السابق
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {activeTab === 'leaves' ? states.length : specialCases.length} من أصل {meta.total} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-slate-800"
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