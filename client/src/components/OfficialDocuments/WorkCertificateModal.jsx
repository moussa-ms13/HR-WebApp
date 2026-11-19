import React, { useState, useEffect } from "react";
import { X, Printer, FileText, Loader2 } from "lucide-react";
import WorkCertificateDocument, {
  WORK_CERT_SIGNATORIES,
} from "./WorkCertificateDocument";
import {
  getTodayIsoDate,
  toIsoDateInput,
  resolveEmployeeFullName,
  resolveEmployeeJobTitle,
  resolveEmployeeDirectorate,
  printOfficialDocumentInIframe,
  useResolvedEmployee,
} from "./officialDocumentUtils";

export default function WorkCertificateModal({ isOpen, onClose, employee }) {
  const { resolvedEmployee, isLoadingEmployee } = useResolvedEmployee(isOpen, employee);
  const [isPrinting, setIsPrinting] = useState(false);

  const [form, setForm] = useState({
    refNumber: "",
    year: String(new Date().getFullYear()),
    issueDate: getTodayIsoDate(),
    signatoryKey: "sub_director",
    fullName: "",
    gender: "ذكر",
    birthDate: "",
    birthPlace: "",
    jobTitle: "",
    directorate: "",
    firstHireDate: "",
  });

  useEffect(() => {
    if (!isOpen || !resolvedEmployee) return;
    setForm((prev) => ({
      ...prev,
      year: String(new Date().getFullYear()),
      issueDate: prev.issueDate || getTodayIsoDate(),
      fullName: resolveEmployeeFullName(resolvedEmployee),
      gender: resolvedEmployee.Gender || "ذكر",
      birthDate: toIsoDateInput(resolvedEmployee.DateOfBirth),
      birthPlace: resolvedEmployee.PlaceOfBirth || "",
      jobTitle: resolveEmployeeJobTitle(resolvedEmployee),
      directorate: resolveEmployeeDirectorate(resolvedEmployee),
      firstHireDate: toIsoDateInput(
        resolvedEmployee.FirstHireDate || resolvedEmployee.InstallationDate
      ),
    }));
  }, [isOpen, resolvedEmployee]);

  if (!isOpen) return null;

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const docProps = {
    employeeId: resolvedEmployee?.Id || resolvedEmployee?.id,
    fullName: form.fullName,
    gender: form.gender,
    birthDate: form.birthDate,
    birthPlace: form.birthPlace,
    jobTitle: form.jobTitle,
    directorate: form.directorate,
    firstHireDate: form.firstHireDate,
    refNumber: form.refNumber,
    year: form.year,
    issueDate: form.issueDate,
    signatoryKey: form.signatoryKey,
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printOfficialDocumentInIframe(
        WorkCertificateDocument,
        docProps,
        `شهادة عمل - ${form.fullName || "موظف"}`
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[1260px] h-[92vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileText size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                إصدار شهادة عمل
              </h2>
              <p className="text-xs text-slate-500">
                {form.fullName || "معاينة فورية وطباعة رسمية بصيغة A4"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-xs transition-colors hover:bg-[#0e3d29] disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: "#124E35" }}
            >
              {isPrinting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Printer size={16} />
              )}
              <span>طباعة الشهادة (A4)</span>
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
          <div className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-l border-slate-200 bg-white overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {isLoadingEmployee && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span>جاري تحميل بيانات الموظف الكاملة...</span>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                بيانات المرجع والختم
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الرقم التسلسلي
                  </label>
                  <input
                    type="text"
                    value={form.refNumber}
                    onChange={(e) => updateField("refNumber", e.target.value)}
                    placeholder="مثال: 145"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ الإصدار
                </label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => updateField("issueDate", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الممضي (السلطة الموقعة)
                </label>
                <select
                  value={form.signatoryKey}
                  onChange={(e) => updateField("signatoryKey", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  {Object.values(WORK_CERT_SIGNATORIES).map((sig) => (
                    <option key={sig.id} value={sig.id}>
                      {sig.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1.5">
                بيانات الموظف (تعبئة تلقائية قابلة للتعديل)
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
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الجنس
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    تاريخ الميلاد
                  </label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => updateField("birthDate", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مكان الميلاد
                  </label>
                  <input
                    type="text"
                    value={form.birthPlace}
                    onChange={(e) => updateField("birthPlace", e.target.value)}
                    placeholder="الشلف"
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الرتبة / المنصب
                </label>
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => updateField("jobTitle", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مكان التعيين (المديرية / المصلحة)
                </label>
                <input
                  type="text"
                  value={form.directorate}
                  onChange={(e) => updateField("directorate", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  تاريخ أول توظيف / تنصيب
                </label>
                <input
                  type="date"
                  value={form.firstHireDate}
                  onChange={(e) => updateField("firstHireDate", e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
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
              <WorkCertificateDocument {...docProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
