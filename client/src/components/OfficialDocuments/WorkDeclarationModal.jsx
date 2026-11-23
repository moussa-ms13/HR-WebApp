import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import WorkDeclarationDocument, {
  WORK_DECL_SIGNATORIES,
} from "./WorkDeclarationDocument";
import {
  getTodayIsoDate,
  toIsoDateInput,
  resolveEmployeeFullName,
  resolveEmployeeJobTitle,
  resolveEmployeeDirectorate,
  printOfficialDocumentInIframe,
  useResolvedEmployee,
} from "./officialDocumentUtils";

export default function WorkDeclarationModal({ isOpen, onClose, employee }) {
  const { resolvedEmployee, isLoadingEmployee } = useResolvedEmployee(
    isOpen,
    employee
  );
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
    startDate: "",
    endDate: getTodayIsoDate(),
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
      birthPlace:
        resolvedEmployee.PlaceOfBirth &&
        resolvedEmployee.PlaceOfBirth !== "غير محدد"
          ? resolvedEmployee.PlaceOfBirth
          : resolvedEmployee.Province || "الشلف",
      jobTitle: resolveEmployeeJobTitle(resolvedEmployee),
      directorate: resolveEmployeeDirectorate(resolvedEmployee),
      startDate: toIsoDateInput(
        resolvedEmployee.FirstHireDate || resolvedEmployee.InstallationDate
      ),
      endDate: prev.endDate || getTodayIsoDate(),
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
    startDate: form.startDate,
    endDate: form.endDate,
    refNumber: form.refNumber,
    year: form.year,
    issueDate: form.issueDate,
    signatoryKey: form.signatoryKey,
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printOfficialDocumentInIframe(
        WorkDeclarationDocument,
        docProps,
        `إقرار بالعمل - ${form.fullName || "موظف"}`
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
        {/* Modal Header (NO icon) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/90 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              إصدار إقرار بالعمل
            </h2>
            <p className="text-xs text-slate-500">
              {form.fullName || "معاينة فورية وطباعة رسمية"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Split Body: Controls (Right) + Live A4 Preview (Left) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Controls Panel */}
          <div className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-l border-slate-200 bg-white flex flex-col min-h-0 max-h-[45vh] lg:max-h-none">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {isLoadingEmployee && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>جاري تحميل بيانات الموظف الكاملة...</span>
                </div>
              )}

              <div className="space-y-3">
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
                    {Object.values(WORK_DECL_SIGNATORIES).map((sig) => (
                      <option key={sig.id} value={sig.id}>
                        {sig.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
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
                    المنصب / الرتبة المشغولة
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
                    مكان العمل / المصلحة
                  </label>
                  <input
                    type="text"
                    value={form.directorate}
                    onChange={(e) => updateField("directorate", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      من تاريخ (بداية الفترة)
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => updateField("startDate", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      إلى غاية (نهاية الفترة)
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => updateField("endDate", e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/70 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isPrinting ? "جاري الطباعة..." : "طباعة الإقرار"}
              </button>
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
              <WorkDeclarationDocument {...docProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
