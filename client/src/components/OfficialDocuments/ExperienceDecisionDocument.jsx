import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import {
  formatOfficialDate,
  getOfficialGenderPhrasing,
  computeExperienceAllowance,
  buildExperienceDecisionQrPayload,
  generateOfficialRefCode,
} from "./officialDocumentUtils";

const FIXED_LEGAL_RECITALS = [
  "بمقتضى الأمر رقم 06-03 المؤرخ في 19 جمادى الثانية عام 1427 الموافق 15 جويلية سنة 2006 والمتضمن القانون الأساسي العام للوظيفة العمومية، المتمم،",
  "وبمقتضى المرسوم الرئاسي رقم 07-304 المؤرخ في 17 رمضان عام 1428 الموافق 29 سبتمبر سنة 2007 الذي يحدد الشبكة الاستدلالية لمرتبات الموظفين ونظام دفع رواتبهم، المعدل والمتمم،",
  "وبمقتضى المرسوم الرئاسي رقم 07-308 المؤرخ في 17 رمضان عام 1428 الموافق 29 سبتمبر سنة 2007 الذي يحدد كيفيات توظيف الأعوان المتعاقدين وحقوقهم وواجباتهم والعناصر المشكلة لرواتبهم والقواعد المتعلقة بتسييرهم وكذا النظام التأديبي المطبق عليهم، المعدل والمتمم،",
  "وبمقتضى المرسوم التنفيذي رقم 90-99 المؤرخ في أول رمضان عام 1410 الموافق 27 مارس سنة 1990 المتعلق بسلطة التعيين والتسيير الإداري، بالنسبة للموظفين وأعوان الإدارة المركزية والولايات والبلديات والمؤسسات العمومية ذات الطابع الإداري،",
  "وبمقتضى المرسوم التنفيذي رقم 21-393 المؤرخ في 18 أكتوبر سنة 2021، يحدد تنظيم المصالح الخارجية للمديرية العامة للأملاك الوطنية وصلاحياتها،",
];

const LtrInline = ({ children, bold = true }) => (
  <span
    dir="ltr"
    style={{
      display: "inline-block",
      direction: "ltr",
      unicodeBidi: "isolate",
      fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
      fontWeight: bold ? "bold" : "normal",
    }}
  >
    {`\u2066${children}\u2069`}
  </span>
);

/**
 * ExperienceDecisionDocument — Official Printable A4 "مقرر تعويض الخبرة المهنية"
 * Strictly calibrated to fit on 1 single A4 page even when all 4 dynamic recitals are active.
 */
export default function ExperienceDecisionDocument({
  employeeId,
  fullName = "",
  gender = "",
  jobTitle = "",
  directorate = "",
  refNumber = "",
  year = new Date().getFullYear(),
  issueDate = "",
  effectiveDate = "",
  years = 0,
  extraPercent = 0,
  targetDirectorTitle = "",
  // 4 Dynamic Career Recitals
  includeTemp = false,
  tempDecNum = "",
  tempDecDate = "",
  tempStartDate = "",
  includeContract = true,
  contractNum = "",
  contractDate = "",
  contractSchedule = "الكامل",
  contractStartDate = "",
  includePrevDecision = false,
  prevDecNum = "",
  prevDecDate = "",
  prevEffectiveDate = "",
  includeNationalService = false,
  nsDecNum = "",
  nsDecDate = "",
}) {
  const g = getOfficialGenderPhrasing(gender);
  const calc = computeExperienceAllowance(years, extraPercent, 1.4);

  const activeDynamicCount = [
    includeTemp,
    includeContract,
    includePrevDecision,
    includeNationalService,
  ].filter(Boolean).length;

  const isDense = activeDynamicCount >= 3;
  const bodyFontSize = isDense ? "11.5pt" : "12.2pt";
  const bodyLineHeight = isDense ? "1.46" : "1.56";
  const recitalMarginBottom = isDense ? "3.5px" : "5px";

  const displayRefNum = String(refNumber || "").trim() || ".............";
  const displayYear = year || new Date().getFullYear();

  const qrPayload = buildExperienceDecisionQrPayload({
    refNumber: String(refNumber || "").trim(),
    year: displayYear,
    employeeId,
    fullName,
    jobTitle,
    years: calc.years,
    totalPercentStr: calc.totalStr,
    effectiveDate,
  });

  const qrRefCode = generateOfficialRefCode("EX", employeeId, refNumber, displayYear);

  const recitalStyle = {
    margin: `0 0 ${recitalMarginBottom} 0`,
    paddingRight: "14px",
    textIndent: "-14px",
    textAlign: "justify",
    fontSize: bodyFontSize,
    lineHeight: bodyLineHeight,
    color: "#111827",
  };

  return (
    <div
      className="official-a4-sheet"
      dir="rtl"
      style={{
        width: "210mm",
        minHeight: "297mm",
        maxHeight: "297mm",
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: isDense ? "10mm 15mm 10mm 15mm" : "12mm 16mm 12mm 16mm",
        boxSizing: "border-box",
        fontFamily: '"Amiri", "Traditional Arabic", Arial, sans-serif',
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ══════════════ HEADER ══════════════ */}
      <div
        style={{
          textAlign: "center",
          fontSize: "13.5pt",
          fontWeight: "bold",
          marginBottom: isDense ? "4px" : "6px",
        }}
      >
        الجمهورية الجزائرية الديمقراطية الشعبية
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          direction: "ltr",
          marginBottom: isDense ? "6px" : "10px",
        }}
      >
        {/* TOP LEFT: QR Code */}
        <DocumentQrBadge payload={qrPayload} referenceCode={qrRefCode} size={64} />

        {/* TOP RIGHT: Ministry & Directorate Hierarchy */}
        <div
          dir="rtl"
          style={{
            textAlign: "right",
            fontSize: "12pt",
            fontWeight: "bold",
            lineHeight: "1.42",
          }}
        >
          <div>وزارة المالية</div>
          <div>المديرية العامة للأملاك الوطنية</div>
          <div>المديرية الجهوية للأملاك الوطنية بالشلف</div>
          <div>المديرية الفرعية للإدارة العامة</div>
          <div style={{ marginTop: "4px", fontSize: "11.5pt" }}>
            رقم: <LtrInline>{displayRefNum}</LtrInline> / م.ج.أ.و.ش /{" "}
            <LtrInline>{displayYear}</LtrInline>
          </div>
        </div>
      </div>

      {/* ══════════════ CENTER TITLE ══════════════ */}
      <div
        style={{
          textAlign: "center",
          fontSize: "16.5pt",
          fontWeight: "bold",
          margin: isDense ? "4px 0 8px" : "6px 0 10px",
          color: "#000000",
        }}
      >
        مقرر تعويض الخبرة المهنية
      </div>

      {/* ══════════════ OPENING AUTHORITY ══════════════ */}
      <div
        style={{
          fontSize: "13.5pt",
          fontWeight: "bold",
          marginBottom: isDense ? "5px" : "7px",
          color: "#000000",
        }}
      >
        إن وزير المالية،
      </div>

      {/* ══════════════ 5 FIXED LEGAL RECITALS ══════════════ */}
      {FIXED_LEGAL_RECITALS.map((text, idx) => (
        <p key={idx} style={recitalStyle}>
          - {text}
        </p>
      ))}

      {/* ══════════════ 4 DYNAMIC CAREER RECITALS ══════════════ */}
      {includeTemp && (
        <p style={recitalStyle}>
          - وبناءً على المقرر رقم{" "}
          <LtrInline>{tempDecNum || "........"}</LtrInline> المؤرخ في{" "}
          <LtrInline>{formatOfficialDate(tempDecDate)}</LtrInline> المتضمن توظيف{" "}
          {g.title}: <strong>{fullName || "................"}</strong> بصفة عون
          مؤقت في منصب شغل <strong>{jobTitle || "................"}</strong>،
          ابتداءً من تاريخ{" "}
          <LtrInline>{formatOfficialDate(tempStartDate)}</LtrInline>،
        </p>
      )}

      {includeContract && (
        <p style={recitalStyle}>
          - وبناءً على عقد عمل رقم{" "}
          <LtrInline>{contractNum || "........"}</LtrInline> المؤرخ في{" "}
          <LtrInline>{formatOfficialDate(contractDate)}</LtrInline> المتضمن توظيف{" "}
          {g.concerned} في منصب شغل{" "}
          <strong>{jobTitle || "................"}</strong> غير محدد المدة بالتوقيت{" "}
          {contractSchedule || "الكامل"}، ابتداءً من تاريخ{" "}
          <LtrInline>{formatOfficialDate(contractStartDate)}</LtrInline>،
        </p>
      )}

      {includePrevDecision && (
        <p style={recitalStyle}>
          - وبناءً على مقرر تعويض الخبرة المهنية رقم{" "}
          <LtrInline>{prevDecNum || "........"}</LtrInline> المؤرخ في{" "}
          <LtrInline>{formatOfficialDate(prevDecDate)}</LtrInline> الخاص{" "}
          {g.concernedWithBi} ابتداءً من{" "}
          <LtrInline>{formatOfficialDate(prevEffectiveDate)}</LtrInline>،
        </p>
      )}

      {includeNationalService && (
        <p style={recitalStyle}>
          - وبناءً على مقرر رقم{" "}
          <LtrInline>{nsDecNum || "........"}</LtrInline> المؤرخ في{" "}
          <LtrInline>{formatOfficialDate(nsDecDate)}</LtrInline> المتضمن استفادة{" "}
          {g.concerned} من تثبيت فترات الخدمة الوطنية والاستبقاء في منصب شغل{" "}
          <strong>{jobTitle || "................"}</strong>،
        </p>
      )}

      {/* ══════════════ PROPOSAL LINE ══════════════ */}
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          fontSize: isDense ? "12.8pt" : "13.5pt",
          margin: isDense ? "8px 0 8px" : "10px 0 10px",
          color: "#000000",
        }}
      >
        وباقتراح من المدير الفرعي للإدارة العامة، يقرر ما يأتي:
      </div>

      {/* ══════════════ ARTICLE 1 ══════════════ */}
      <div
        style={{
          fontSize: isDense ? "12pt" : "12.8pt",
          lineHeight: isDense ? "1.55" : "1.65",
          textAlign: "justify",
          marginBottom: isDense ? "6px" : "9px",
        }}
      >
        <strong>المادة الأولى:</strong> {g.benefits} {g.title}{" "}
        <strong>{fullName || "................"}</strong>، {g.asRole}{" "}
        <strong>{jobTitle || "................"}</strong> لدى{" "}
        <strong>{directorate || "المديرية الجهوية للأملاك الوطنية بالشلف"}</strong>،
        من تعويض الخبرة المهنية كما يلي:
        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            fontSize: isDense ? "12.5pt" : "13.2pt",
            marginTop: isDense ? "4px" : "6px",
            color: "#000000",
          }}
        >
          -{" "}
          <span
            dir="rtl"
            style={{
              display: "inline-block",
              unicodeBidi: "isolate",
            }}
          >
            (<LtrInline>{calc.years}</LtrInline> سنة ×{" "}
            <LtrInline>{calc.rateStr}%</LtrInline>)
            {calc.hasExtra ? (
              <>
                {" "}
                + <LtrInline>{calc.extraStr}%</LtrInline>
              </>
            ) : null}{" "}
            = <LtrInline>{calc.totalStr}%</LtrInline>
          </span>
        </div>
      </div>

      {/* ══════════════ ARTICLE 02 ══════════════ */}
      <div
        style={{
          fontSize: isDense ? "12pt" : "12.8pt",
          lineHeight: isDense ? "1.55" : "1.65",
          textAlign: "justify",
          marginBottom: isDense ? "12px" : "18px",
        }}
      >
        <strong>المادة 02:</strong> يكلف السيدان المدير الفرعي للإدارة العامة و
        <strong>
          {targetDirectorTitle || "مدير أملاك الدولة لولاية الشلف"}
        </strong>
        ، كل حسب اختصاصه، بتنفيذ هذا المقرر الذي يسري مفعوله ابتداءً من{" "}
        <LtrInline>{formatOfficialDate(effectiveDate)}</LtrInline>.
      </div>

      {/* ══════════════ FOOTER / SIGNATURE DATE ══════════════ */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          paddingLeft: "18mm",
          marginTop: isDense ? "10px" : "16px",
        }}
      >
        <div style={{ width: "240px", textAlign: "center" }}>
          <div style={{ fontSize: "12.8pt", fontWeight: "bold", color: "#000000" }}>
            حرر بالشلف، في{" "}
            {issueDate ? (
              <LtrInline>{formatOfficialDate(issueDate)}</LtrInline>
            ) : (
              "..................."
            )}
          </div>
          <div style={{ height: isDense ? "14mm" : "20mm" }} />
        </div>
      </div>
    </div>
  );
}
