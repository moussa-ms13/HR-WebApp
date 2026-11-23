import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import WorkCertificateFrDocument, {
  WORK_CERT_FR_SIGNATORIES,
} from "./WorkCertificateFrDocument";
import {
  getTodayIsoDate,
  toIsoDateInput,
  resolveEmployeeFullName,
  useResolvedEmployee,
} from "./officialDocumentUtils";
import {
  resolveEmployeeFrenchFullName,
  translateRankToFrench,
  translateBirthPlaceToFrench,
  translateDirectorateToFrench,
  translateHighPositionToFrench,
  printFrenchOfficialDocumentInIframe,
} from "./frenchDocumentHelpers";

export default function WorkCertificateFrModal({ isOpen, onClose, employee }) {
  const { resolvedEmployee, isLoadingEmployee } = useResolvedEmployee(
    isOpen,
    employee
  );
  const [isPrinting, setIsPrinting] = useState(false);

  const [form, setForm] = useState({
    refNumber: "",
    year: String(new Date().getFullYear()),
    issueDate: getTodayIsoDate(),
    signatoryKey: "le_directeur",
    fullNameFr: "",
    gender: "ذكر",
    birthDate: "",
    birthPlaceFr: "Chlef",
    rankFr: "",
    directorateFr: "Direction REGIONALE DU DOMAINE de CHLEF",
    firstHireDate: "",
    includeHighPosition: false,
    highPositionFr: "",
  });

  useEffect(() => {
    if (!isOpen || !resolvedEmployee) return;
    const isContractual =
      resolvedEmployee.EmployeeStatus === "متعاقد" ||
      resolvedEmployee.CorpsType === "متعاقد" ||
      (resolvedEmployee.JobTitle?.EmploymentCategory || "").includes("متعاقد");

    const rawAssignedPos = String(resolvedEmployee.AssignedPosition || "").trim();
    const hasValidHighPos =
      !isContractual &&
      Boolean(rawAssignedPos) &&
      rawAssignedPos !== "غير محدد" &&
      rawAssignedPos !== "لا شيء";

    const rawRankAr =
      resolvedEmployee.JobTitle?.RankName ||
      resolvedEmployee.RankName ||
      resolvedEmployee.JobTitleName ||
      "";

    setForm((prev) => ({
      ...prev,
      year: String(new Date().getFullYear()),
      issueDate: prev.issueDate || getTodayIsoDate(),
      fullNameFr: resolveEmployeeFrenchFullName(resolvedEmployee),
      gender: resolvedEmployee.Gender || "ذكر",
      birthDate: toIsoDateInput(resolvedEmployee.DateOfBirth),
      birthPlaceFr: translateBirthPlaceToFrench(
        resolvedEmployee.PlaceOfBirth,
        resolvedEmployee.Province
      ),
      rankFr: translateRankToFrench(rawRankAr),
      directorateFr: translateDirectorateToFrench(resolvedEmployee),
      firstHireDate: toIsoDateInput(
        resolvedEmployee.FirstHireDate || resolvedEmployee.InstallationDate
      ),
      includeHighPosition: hasValidHighPos,
      highPositionFr: hasValidHighPos
        ? translateHighPositionToFrench(rawAssignedPos)
        : "",
    }));
  }, [isOpen, resolvedEmployee]);

  if (!isOpen) return null;

  const isEmployeeContractual =
    resolvedEmployee?.EmployeeStatus === "متعاقد" ||
    resolvedEmployee?.CorpsType === "متعاقد" ||
    (resolvedEmployee?.JobTitle?.EmploymentCategory || "").includes("متعاقد");

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const docProps = {
    employeeId: resolvedEmployee?.Id || resolvedEmployee?.id,
    fullNameFr: form.fullNameFr,
    gender: form.gender,
    birthDate: form.birthDate,
    birthPlaceFr: form.birthPlaceFr,
    rankFr: form.rankFr,
    directorateFr: form.directorateFr,
    firstHireDate: form.firstHireDate,
    includeHighPosition: !isEmployeeContractual && form.includeHighPosition,
    highPositionFr: form.highPositionFr,
    refNumber: form.refNumber,
    year: form.year,
    issueDate: form.issueDate,
    signatoryKey: form.signatoryKey,
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printFrenchOfficialDocumentInIframe(
        WorkCertificateFrDocument,
        docProps,
        `ATTESTATION DE TRAVAIL - ${form.fullNameFr || "EMPLOYE"}`
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const arabicDisplayName = resolveEmployeeFullName(resolvedEmployee);

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
              إصدار شهادة عمل (فرنسية)
            </h2>
            <p className="text-xs text-slate-500">
              {arabicDisplayName || form.fullNameFr || "ATTESTATION DE TRAVAIL"}
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
                      الرقم التسلسلي (N°)
                    </label>
                    <input
                      type="text"
                      value={form.refNumber}
                      onChange={(e) => updateField("refNumber", e.target.value)}
                      placeholder="مثال: 41"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                      dir="ltr"
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
                    الممضي (Signataire)
                  </label>
                  <select
                    value={form.signatoryKey}
                    onChange={(e) => updateField("signatoryKey", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                  >
                    {Object.values(WORK_CERT_FR_SIGNATORIES).map((sig) => (
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
                      اللقب والاسم (Nom & Prénom)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.fullNameFr}
                      onChange={(e) =>
                        updateField("fullNameFr", e.target.value.toUpperCase())
                      }
                      placeholder="ZEBOUDJ HADJIRA"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none uppercase font-semibold"
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
                      <option value="ذكر">ذكر (M.)</option>
                      <option value="أنثى">أنثى (Mme)</option>
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
                      مكان الميلاد (Lieu)
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={form.birthPlaceFr}
                      onChange={(e) =>
                        updateField("birthPlaceFr", e.target.value)
                      }
                      placeholder="Chlef"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الرتبة (Grade / Qualité)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.rankFr}
                    onChange={(e) => updateField("rankFr", e.target.value)}
                    placeholder="Inspecteur Central"
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الهيئة / المديرية (Direction)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.directorateFr}
                    onChange={(e) =>
                      updateField("directorateFr", e.target.value)
                    }
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
                    onChange={(e) =>
                      updateField("firstHireDate", e.target.value)
                    }
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {!isEmployeeContractual && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.includeHighPosition}
                        onChange={(e) =>
                          updateField("includeHighPosition", e.target.checked)
                        }
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        تضمين المنصب العالي (Poste supérieur)
                      </span>
                    </label>

                    {form.includeHighPosition && (
                      <input
                        type="text"
                        dir="ltr"
                        value={form.highPositionFr}
                        onChange={(e) =>
                          updateField("highPositionFr", e.target.value)
                        }
                        placeholder="Sous Directeur Régional Des Activités Des Domaines De L'état"
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/70 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isPrinting ? "جاري الطباعة..." : "طباعة الشهادة"}
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
              <WorkCertificateFrDocument {...docProps} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
