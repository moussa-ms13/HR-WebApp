import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import WorkCertificateDocument, {
  WORK_CERT_SIGNATORIES,
} from "./WorkCertificateDocument";
import WorkCertificateFrDocument, {
  WORK_CERT_FR_SIGNATORIES,
} from "./WorkCertificateFrDocument";
import {
  getTodayIsoDate,
  toIsoDateInput,
  resolveEmployeeFullName,
  resolveEmployeeJobTitle,
  resolveEmployeeDirectorate,
  printOfficialDocumentInIframe,
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

export default function WorkCertificateModal({
  isOpen,
  onClose,
  employee,
  initialLanguage = "ar",
}) {
  const { resolvedEmployee, isLoadingEmployee } = useResolvedEmployee(
    isOpen,
    employee
  );
  const [lang, setLang] = useState(initialLanguage === "fr" ? "fr" : "ar");
  const [isPrinting, setIsPrinting] = useState(false);

  const [form, setForm] = useState({
    // Shared fields across Arabic & French
    refNumber: "",
    year: String(new Date().getFullYear()),
    issueDate: getTodayIsoDate(),
    gender: "ذكر",
    birthDate: "",
    firstHireDate: "",
    interestedCopies: 1,
    archiveCopies: 1,
    // Arabic fields
    signatoryKeyAr: "sub_director",
    fullNameAr: "",
    birthPlaceAr: "",
    jobTitleAr: "",
    directorateAr: "",
    // French fields
    signatoryKeyFr: "le_directeur",
    fullNameFr: "",
    birthPlaceFr: "Chlef",
    rankFr: "",
    directorateFr: "Direction REGIONALE DU DOMAINE de CHLEF",
    includeHighPosition: false,
    highPositionFr: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    setLang(initialLanguage === "fr" ? "fr" : "ar");
  }, [isOpen, initialLanguage]);

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

    const rawRankAr = resolveEmployeeJobTitle(resolvedEmployee);

    setForm((prev) => ({
      ...prev,
      year: String(new Date().getFullYear()),
      issueDate: prev.issueDate || getTodayIsoDate(),
      gender: resolvedEmployee.Gender || "ذكر",
      birthDate: toIsoDateInput(resolvedEmployee.DateOfBirth),
      firstHireDate: toIsoDateInput(
        resolvedEmployee.FirstHireDate || resolvedEmployee.InstallationDate
      ),
      // Arabic
      fullNameAr: resolveEmployeeFullName(resolvedEmployee),
      birthPlaceAr:
        resolvedEmployee.PlaceOfBirth &&
        resolvedEmployee.PlaceOfBirth !== "غير محدد"
          ? resolvedEmployee.PlaceOfBirth
          : "",
      jobTitleAr: rawRankAr,
      directorateAr: resolveEmployeeDirectorate(resolvedEmployee),
      // French
      fullNameFr: resolveEmployeeFrenchFullName(resolvedEmployee),
      birthPlaceFr: translateBirthPlaceToFrench(
        resolvedEmployee.PlaceOfBirth,
        resolvedEmployee.Province
      ),
      rankFr: translateRankToFrench(rawRankAr),
      directorateFr: translateDirectorateToFrench(resolvedEmployee),
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

  const safeInterestedCopies = Math.max(
    1,
    Math.min(20, parseInt(form.interestedCopies, 10) || 1)
  );
  const safeArchiveCopies = Math.max(
    1,
    Math.min(10, parseInt(form.archiveCopies, 10) || 1)
  );

  const empId = resolvedEmployee?.Id || resolvedEmployee?.id;

  const arDocProps = {
    employeeId: empId,
    fullName: form.fullNameAr,
    gender: form.gender,
    birthDate: form.birthDate,
    birthPlace: form.birthPlaceAr,
    jobTitle: form.jobTitleAr,
    directorate: form.directorateAr,
    firstHireDate: form.firstHireDate,
    refNumber: form.refNumber,
    year: form.year,
    issueDate: form.issueDate,
    signatoryKey: form.signatoryKeyAr,
    interestedCopies: safeInterestedCopies,
    archiveCopies: safeArchiveCopies,
  };

  const frDocProps = {
    employeeId: empId,
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
    signatoryKey: form.signatoryKeyFr,
    interestedCopies: safeInterestedCopies,
    archiveCopies: safeArchiveCopies,
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (lang === "fr") {
        await printFrenchOfficialDocumentInIframe(
          WorkCertificateFrDocument,
          frDocProps,
          `ATTESTATION DE TRAVAIL - ${form.fullNameFr || "EMPLOYE"}`
        );
      } else {
        await printOfficialDocumentInIframe(
          WorkCertificateDocument,
          arDocProps,
          `شهادة عمل - ${form.fullNameAr || "موظف"}`
        );
      }
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
              إصدار شهادة عمل
            </h2>
            <p className="text-xs text-slate-500">
              {form.fullNameAr || form.fullNameFr || "معاينة فورية وطباعة رسمية"}
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
          <div className="w-full lg:w-[360px] shrink-0 border-b lg:border-b-0 lg:border-l border-slate-200 bg-white flex flex-col min-h-0 max-h-[48vh] lg:max-h-none">
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {/* Language Switcher Segmented Control */}
              <div className="bg-slate-100 p-1 rounded-lg grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setLang("ar")}
                  className={`py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                    lang === "ar"
                      ? "bg-white text-emerald-700 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800 font-medium"
                  }`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => setLang("fr")}
                  className={`py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                    lang === "fr"
                      ? "bg-white text-emerald-700 font-semibold shadow-sm"
                      : "text-slate-600 hover:text-slate-800 font-medium"
                  }`}
                >
                  الفرنسية
                </button>
              </div>

              {isLoadingEmployee && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>جاري تحميل بيانات الموظف الكاملة...</span>
                </div>
              )}

              {/* Shared Reference & Issue Date Fields */}
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

                {/* Signatory Dropdown (Language-Aware) */}
                {lang === "ar" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      الممضي (السلطة الموقعة)
                    </label>
                    <select
                      value={form.signatoryKeyAr}
                      onChange={(e) =>
                        updateField("signatoryKeyAr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      {Object.values(WORK_CERT_SIGNATORIES).map((sig) => (
                        <option key={sig.id} value={sig.id}>
                          {sig.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      الممضي (Signataire)
                    </label>
                    <select
                      value={form.signatoryKeyFr}
                      onChange={(e) =>
                        updateField("signatoryKeyFr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                    >
                      {Object.values(WORK_CERT_FR_SIGNATORIES).map((sig) => (
                        <option key={sig.id} value={sig.id}>
                          {sig.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Employee & Career Fields (Language-Aware) */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === "ar"
                        ? "اللقب والاسم"
                        : "اللقب والاسم (Nom & Prénom)"}
                    </label>
                    {lang === "ar" ? (
                      <input
                        type="text"
                        value={form.fullNameAr}
                        onChange={(e) =>
                          updateField("fullNameAr", e.target.value)
                        }
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
                      <input
                        type="text"
                        dir="ltr"
                        value={form.fullNameFr}
                        onChange={(e) =>
                          updateField(
                            "fullNameFr",
                            e.target.value.toUpperCase()
                          )
                        }
                        placeholder="ZEBOUDJ HADJIRA"
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none uppercase font-semibold"
                      />
                    )}
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
                      <option value="ذكر">
                        {lang === "ar" ? "ذكر" : "ذكر (M.)"}
                      </option>
                      <option value="أنثى">
                        {lang === "ar" ? "أنثى" : "أنثى (Mme)"}
                      </option>
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
                      {lang === "ar" ? "مكان الميلاد" : "مكان الميلاد (Lieu)"}
                    </label>
                    {lang === "ar" ? (
                      <input
                        type="text"
                        value={form.birthPlaceAr}
                        onChange={(e) =>
                          updateField("birthPlaceAr", e.target.value)
                        }
                        placeholder="الشلف"
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    ) : (
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
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === "ar"
                      ? "الرتبة / المنصب"
                      : "الرتبة (Grade / Qualité)"}
                  </label>
                  {lang === "ar" ? (
                    <input
                      type="text"
                      value={form.jobTitleAr}
                      onChange={(e) =>
                        updateField("jobTitleAr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      dir="ltr"
                      value={form.rankFr}
                      onChange={(e) => updateField("rankFr", e.target.value)}
                      placeholder="Inspecteur Central"
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === "ar"
                      ? "مكان التعيين (المديرية / المصلحة)"
                      : "الهيئة / المديرية (Direction)"}
                  </label>
                  {lang === "ar" ? (
                    <input
                      type="text"
                      value={form.directorateAr}
                      onChange={(e) =>
                        updateField("directorateAr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      dir="ltr"
                      value={form.directorateFr}
                      onChange={(e) =>
                        updateField("directorateFr", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  )}
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

                {/* Shared Editable Copy Counts Row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      نسخ المعني(ة)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={form.interestedCopies}
                      onChange={(e) =>
                        updateField("interestedCopies", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      نسخ ملف الأرشفة
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={form.archiveCopies}
                      onChange={(e) =>
                        updateField("archiveCopies", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* French-Only Optional High Position Toggle */}
                {lang === "fr" && !isEmployeeContractual && (
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
              {lang === "fr" ? (
                <WorkCertificateFrDocument {...frDocProps} />
              ) : (
                <WorkCertificateDocument {...arDocProps} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
