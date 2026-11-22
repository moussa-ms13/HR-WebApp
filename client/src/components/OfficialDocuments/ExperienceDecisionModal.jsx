import React, { useState, useEffect } from "react";
import { X, Printer, Award, Loader2 } from "lucide-react";
import ExperienceDecisionDocument from "./ExperienceDecisionDocument";
import ExperienceRecitalsForm from "./ExperienceRecitalsForm";
import {
  getTodayIsoDate,
  toIsoDateInput,
  suggestExperienceYears,
  computeExperienceAllowance,
  resolveEmployeeFullName,
  resolveEmployeeJobTitle,
  resolveEmployeeDirectorate,
  resolveTargetDirectorTitle,
  parseAdministrativeReference,
  detectWorkSchedule,
  printOfficialDocumentInIframe,
  useResolvedEmployee,
} from "./officialDocumentUtils";

export default function ExperienceDecisionModal({
  isOpen,
  onClose,
  employee,
  experienceRecord = null,
  previousExperienceRecord = null,
  contractMovement = null,
}) {
  const { resolvedEmployee, isLoadingEmployee } = useResolvedEmployee(isOpen, employee);
  const [isPrinting, setIsPrinting] = useState(false);

  const [form, setForm] = useState({
    refNumber: "",
    year: String(new Date().getFullYear()),
    issueDate: getTodayIsoDate(),
    effectiveDate: getTodayIsoDate(),
    fullName: "",
    gender: "ذكر",
    jobTitle: "",
    directorate: "",
    targetDirectorTitle: "",
    years: 0,
    extraPercent: 0,
    // 4 dynamic career recitals
    includeTemp: false,
    tempDecNum: "",
    tempDecDate: "",
    tempStartDate: "",
    includeContract: true,
    contractNum: "",
    contractDate: "",
    contractSchedule: "الكامل",
    contractStartDate: "",
    includePrevDecision: false,
    prevDecNum: "",
    prevDecDate: "",
    prevEffectiveDate: "",
    includeNationalService: false,
    nsDecNum: "",
    nsDecDate: "",
  });

  useEffect(() => {
    if (!isOpen || !resolvedEmployee) return;

    const hireDate =
      resolvedEmployee.FirstHireDate || resolvedEmployee.InstallationDate;
    const resolvedDir = resolveEmployeeDirectorate(resolvedEmployee);

    // 1. Parse selected experience allowance record (if provided)
    const parsedCurRef = parseAdministrativeReference(experienceRecord?.ReferenceDoc);
    const resolvedYears =
      experienceRecord?.DegreeLevel != null && experienceRecord.DegreeLevel !== ""
        ? Number(experienceRecord.DegreeLevel)
        : suggestExperienceYears(hireDate);
    const resolvedEffectiveDate =
      toIsoDateInput(experienceRecord?.EffectiveDate) || getTodayIsoDate();
    const resolvedIssueDate = parsedCurRef.dateIso || getTodayIsoDate();
    const resolvedYear = parsedCurRef.dateIso
      ? parsedCurRef.dateIso.slice(0, 4)
      : resolvedEffectiveDate
      ? resolvedEffectiveDate.slice(0, 4)
      : String(new Date().getFullYear());

    // 2. Parse immediately preceding experience allowance record (if any)
    const hasPrev = Boolean(previousExperienceRecord);
    const parsedPrevRef = parseAdministrativeReference(
      previousExperienceRecord?.ReferenceDoc
    );
    const resolvedPrevEffectiveDate = toIsoDateInput(
      previousExperienceRecord?.EffectiveDate
    );

    // 3. Parse matching work contract movement from "حركة في الرتب" (if any)
    const parsedContractRef = parseAdministrativeReference(
      contractMovement?.Reference
    );
    const resolvedContractStartDate =
      toIsoDateInput(contractMovement?.InstallDate) || toIsoDateInput(hireDate);
    const resolvedSchedule = detectWorkSchedule(contractMovement, resolvedEmployee);

    setForm({
      refNumber: parsedCurRef.number || "",
      year: resolvedYear,
      issueDate: resolvedIssueDate,
      effectiveDate: resolvedEffectiveDate,
      fullName: resolveEmployeeFullName(resolvedEmployee),
      gender: resolvedEmployee.Gender || "ذكر",
      jobTitle:
        resolveEmployeeJobTitle(resolvedEmployee) ||
        contractMovement?.RankName ||
        "",
      directorate: resolvedDir,
      targetDirectorTitle: resolveTargetDirectorTitle(
        resolvedEmployee.Directorate || resolvedDir,
        resolvedEmployee.Province
      ),
      years: resolvedYears,
      extraPercent: 0,
      // Dynamic career recitals
      includeTemp: false,
      tempDecNum: "",
      tempDecDate: "",
      tempStartDate: "",
      includeContract: true,
      contractNum: parsedContractRef.number || "",
      contractDate: parsedContractRef.dateIso || "",
      contractSchedule: resolvedSchedule,
      contractStartDate: resolvedContractStartDate,
      includePrevDecision: hasPrev,
      prevDecNum: hasPrev ? parsedPrevRef.number : "",
      prevDecDate: hasPrev ? parsedPrevRef.dateIso : "",
      prevEffectiveDate: hasPrev ? resolvedPrevEffectiveDate : "",
      includeNationalService: false,
      nsDecNum: "",
      nsDecDate: "",
    });
  }, [
    isOpen,
    resolvedEmployee,
    experienceRecord,
    previousExperienceRecord,
    contractMovement,
  ]);

  if (!isOpen) return null;

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const calc = computeExperienceAllowance(form.years, form.extraPercent, 1.4);

  const docProps = {
    employeeId: resolvedEmployee?.Id || resolvedEmployee?.id,
    ...form,
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printOfficialDocumentInIframe(
        ExperienceDecisionDocument,
        docProps,
        `مقرر تعويض الخبرة المهنية - ${form.fullName || "موظف"}`
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-[2px] p-3 sm:p-5 font-sans"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[1300px] h-[94vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Award size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                إصدار مقرر تعويض الخبرة المهنية
              </h2>
              <p className="text-xs text-slate-500">
                {form.fullName || "إعداد الحيثيات وحساب النسبة تلقائياً"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isPrinting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Printer size={16} />
              )}
              <span>طباعة المقرر (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Split Body: Controls (Right) + Live A4 Preview (Left) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Controls Panel */}
          <div className="w-full lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-l border-slate-200 bg-white overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isLoadingEmployee && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span>جاري تحميل بيانات الموظف الكاملة...</span>
              </div>
            )}

            {/* Reference & Dates */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                المرجع والتواريخ
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    رقم المقرر
                  </label>
                  <input
                    type="text"
                    value={form.refNumber}
                    onChange={(e) => updateField("refNumber", e.target.value)}
                    placeholder="مثال: 214"
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    السنة
                  </label>
                  <input
                    type="text"
                    value={form.year}
                    onChange={(e) => updateField("year", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاريخ سريان المفعول
                  </label>
                  <input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) => updateField("effectiveDate", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاريخ التحرير
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => updateField("issueDate", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Experience Calculation */}
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                حساب نسبة تعويض الخبرة المهنية (1,4%)
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    عدد السنوات
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={form.years}
                    onChange={(e) => updateField("years", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    نسبة إضافية (%) اختيارية
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.extraPercent}
                    onChange={(e) => updateField("extraPercent", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
                <span className="text-xs font-bold text-emerald-900">
                  {calc.formulaText}
                </span>
              </div>
            </div>

            {/* Employee & Execution Authority */}
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                بيانات المعني وسلطة التنفيذ
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اللقب والاسم
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateField("fullName", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الجنس
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  منصب الشغل / الرتبة
                </label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => updateField("jobTitle", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المديرية / مكان التعيين
                </label>
                <input
                  type="text"
                  value={form.directorate}
                  onChange={(e) => updateField("directorate", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المدير الولائي المكلف بالتنفيذ (المادة 02)
                </label>
                <input
                  type="text"
                  value={form.targetDirectorTitle}
                  onChange={(e) =>
                    updateField("targetDirectorTitle", e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* 4 Optional Dynamic Recitals */}
            <ExperienceRecitalsForm form={form} updateField={updateField} />
          </div>

          {/* Live A4 Preview Area */}
          <div className="flex-1 bg-slate-200/80 overflow-auto p-4 sm:p-6 flex justify-center items-start custom-scrollbar">
            <div
              className="shadow-xl ring-1 ring-slate-300/80 bg-white origin-top"
              style={{
                width: "210mm",
                minHeight: "297mm",
                transform: "scale(0.76)",
                marginBottom: "-70mm",
              }}
            >
              <ExperienceDecisionDocument {...docProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
