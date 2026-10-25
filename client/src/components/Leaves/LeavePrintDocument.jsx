import React from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import {
  getGenderProfile,
  LEGAL_PROFILES,
  formatAlgerianAdministrativeDate,
  formatAdminDate,
  isContractualEmployee,
  SICK_LEAVE_SOCIAL_SECURITY_LAW,
  CIVIL_SERVICE_ORDINANCE,
  CONTRACTUAL_STAFF_DECREE,
  SICK_LEAVE_PROPOSAL,
  SICK_LEAVE_ARTICLE_3,
  SICK_LEAVE_SIGNATORY_TITLE,
  ANNUAL_LEAVE_SIGNATORY_TITLE,
} from "../../utils/leaveCertificateConfig";
import { addOneDay } from "../../utils/dateUtils";

/* ── LTR wrapper for standalone numbers (days count, year) inside RTL ── */
const LTR = ({ children, className = "", style = {} }) => (
  <bdi dir="ltr" className={className} style={{ unicodeBidi: "isolate", ...style }}>
    {children}
  </bdi>
);

/**
 * AdminDate — Strictly renders YYYY/MM/DD (e.g. 2026/10/08) inside an isolated LTR container,
 * guaranteeing that Arabic BiDi text does NOT flip or scramble the slashes and numbers.
 */
export const AdminDate = ({ dateInput, value, className = "" }) => {
  const input = value !== undefined ? value : dateInput;
  if (!input) return null;
  const formatted = formatAdminDate(input);
  if (!formatted) return null;
  return (
    <span
      dir="ltr"
      className={`inline-block font-sans font-bold ${className}`}
      style={{
        direction: "ltr",
        unicodeBidi: "isolate",
        fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
      }}
    >
      {`\u2066${formatted}\u2069`}
    </span>
  );
};

/**
 * LeavePrintDocument — Official Annual Leave ("سند عطلة سنوية") & Sick Leave ("مقرر عطلة مرضية")
 *
 * Renders an official Algerian administrative document strictly calibrated to fit
 * on ONE SINGLE A4 PAGE with prominent typography and unified fonts.
 */
export default function LeavePrintDocument(props) {
  const {
    leaveType: propLeaveType,
    corpsType = "common",
    genderProfile,
    header = {},
    employee = {},
    decision = {},
    leave = {},
    signature = {},
    qrPayload = "",
    referenceCode = "",
    warnings = [],
  } = props;

  const data = {
    ...leave,
    ...props.data,
    ...props,
    hasSecondCertificate: Boolean(
      leave.hasSecondCertificate ??
      props.hasSecondCertificate ??
      props.SecondDoctorName ??
      props.secondDoctorName ??
      props.doctorName2 ??
      props.SecondCertificateDate ??
      props.secondCertificateDate ??
      props.certificateDate2 ??
      leave.secondDoctorName ??
      leave.secondCertificateDate ??
      leave.doctorName2 ??
      leave.certificateDate2
    ),
    doctorName:
      leave.doctorName ||
      props.doctorName ||
      props.DoctorName ||
      leave.DoctorName ||
      "",
    certificateDate:
      leave.certificateDate ||
      props.certificateDate ||
      props.CertificateDate ||
      leave.CertificateDate ||
      "",
    secondDoctorName:
      leave.secondDoctorName ||
      props.secondDoctorName ||
      props.SecondDoctorName ||
      props.doctorName2 ||
      leave.SecondDoctorName ||
      leave.doctorName2 ||
      "",
    secondCertificateDate:
      leave.secondCertificateDate ||
      props.secondCertificateDate ||
      props.SecondCertificateDate ||
      props.certificateDate2 ||
      leave.SecondCertificateDate ||
      leave.certificateDate2 ||
      "",
  };

  const resolvedCorpsType = (corpsType === "contractual" || isContractualEmployee(employee))
    ? "contractual"
    : (corpsType || "common");

  const legal = LEGAL_PROFILES[resolvedCorpsType] ?? LEGAL_PROFILES.common;
  const isSickLeave =
    propLeaveType === "عطلة مرضية" ||
    leave?.type === "عطلة مرضية" ||
    leave?.StateTypeOrReason === "عطلة مرضية" ||
    props?.StateTypeOrReason === "عطلة مرضية";

  const isMaternityLeave =
    propLeaveType === "عطلة أمومة" ||
    leave?.type === "عطلة أمومة" ||
    leave?.StateTypeOrReason === "عطلة أمومة" ||
    props?.StateTypeOrReason === "عطلة أمومة";

  const isDecisionDoc = isSickLeave || isMaternityLeave;

  const rawDirectorate = decision.directorateName || "المديرية الجهوية للأملاك الوطنية بالشلف";
  const directorateName = rawDirectorate
    .replace(/المديرية الجهوية للأملاك الوطنية\s+(?:الناحية|ناحية)\s+الشلف/g, "المديرية الجهوية للأملاك الوطنية بالشلف")
    .replace(/(?:الناحية|ناحية)\s+الشلف/g, "بالشلف");

  const g = isMaternityLeave
    ? getGenderProfile("female")
    : (genderProfile || getGenderProfile("male"));

  // Strictly format employee name as "LastName FirstName" (اللقب ثم الاسم)
  const formattedEmployeeName = (() => {
    const empSrc = employee || {};
    const lastName = (empSrc.LastName || empSrc.lastName || props.LastName || props.lastName || props.Employee?.LastName || props.Employee?.lastName || "").trim();
    const firstName = (empSrc.Name || empSrc.firstName || props.Name || props.firstName || props.Employee?.Name || props.Employee?.firstName || "").trim();
    if (lastName && firstName && lastName !== firstName) {
      return `${lastName} ${firstName}`;
    }
    return empSrc.name || empSrc.fullName || props.employeeName || [lastName, firstName].filter(Boolean).join(" ").trim();
  })();

  const annualResumeDate = addOneDay(leave.endDate || leave.EndDate || props.endDate || props.EndDate);
  const resumeDateToDisplay = !isDecisionDoc ? (annualResumeDate || leave.resumeDate) : leave.resumeDate;

  return (
    <div
      className={`leave-doc-page ${isDecisionDoc ? "sick-leave-doc" : "annual-leave-doc"}`}
      dir="rtl"
      style={{
        fontFamily: "'Amiri', 'Traditional Arabic', Arial, sans-serif",
        fontSize: "14pt",
        lineHeight: "1.55",
        color: "#111827",
        maxHeight: "297mm",
        overflow: "hidden",
        pageBreakInside: "avoid",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

        @page {
          size: A4 portrait;
          margin: 10mm 15mm 12mm 15mm;
        }

        @media print {
          html, body {
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: hidden !important;
          }
          .leave-doc-page {
            width: 100% !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 0 12mm 0 !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            background: white !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }

        .leave-doc-page {
          width: 100%;
          box-sizing: border-box;
          font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
          color: #111827;
          direction: rtl;
        }
        .leave-doc-page * {
          box-sizing: border-box;
        }

        @media screen {
          .leave-doc-page {
            max-width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            margin: 0 auto;
            padding: 10mm 15mm 14mm 15mm;
            background: #fff;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
            overflow: hidden;
          }
        }

        /* ── Titles & Sections (Annual Leave Golden-Middle Calibration) ── */
        .doc-title {
          text-align: center;
          font-weight: bold;
          font-size: 16.5pt;
          text-decoration: underline;
          text-underline-offset: 3px;
          margin: 8px 0 10px;
          letter-spacing: 0.5px;
          color: #000;
        }

        .doc-intro {
          font-weight: bold;
          margin-top: 6px;
          margin-bottom: 4px;
          font-size: 13.5pt;
          color: #000;
        }

        .doc-whereas {
          margin: 0 0 3.5px;
          padding-right: 14px;
          text-indent: -14px;
          text-align: justify;
          font-size: 13.2pt;
          line-height: 1.50;
          color: #111827;
        }
        .doc-whereas strong {
          font-weight: bold;
          font-size: 13.6pt;
          color: #000;
        }

        .doc-decides {
          text-align: center;
          font-weight: bold;
          margin: 7px 0 8px;
          letter-spacing: 1.5px;
          font-size: 14pt;
          color: #000;
        }

        /* ── Articles & Body Rows (Annual Leave: 13.4pt / 13.8pt bold) ── */
        .doc-article {
          margin-bottom: 2px;
        }

        .doc-article-line {
          margin: 3px 0;
          font-size: 13.4pt;
          line-height: 1.50;
          color: #111827;
        }
        .doc-article-line strong {
          font-weight: bold;
          font-size: 13.8pt;
          color: #000;
        }

        .doc-note-line {
          margin: 3px 0;
          font-size: 13.4pt;
          line-height: 1.50;
          color: #111827;
        }
        .doc-note-line strong {
          font-weight: bold;
          font-size: 13.8pt;
          color: #000;
        }

        .doc-remark {
          margin-top: 6px;
          margin-bottom: 4px;
          font-size: 13.2pt;
          line-height: 1.48;
          color: #111827;
        }
        .doc-remark strong {
          font-weight: bold;
          font-size: 13.8pt;
          color: #000;
        }
        .doc-remark-label {
          font-weight: bold;
          text-decoration: underline;
        }

        /* ── Signature & Stamp Block (Annual Leave) ── */
        .doc-signature {
          margin-top: 8mm;
          margin-bottom: 4px;
          width: 250px;
          margin-left: 14px;
          margin-right: auto;
          margin-inline-start: auto;
          margin-inline-end: 14px;
          text-align: center;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .doc-signature-place {
          font-size: 13pt;
          color: #111827;
          text-align: center;
          margin-bottom: 0;
        }
        .doc-stamp-area {
          height: 10mm; /* ~1.0cm compact clearance leaving ample space for stamp and signature inside A4 */
        }
        .doc-signature-title {
          font-weight: bold;
          font-size: 13.8pt;
          color: #000;
          text-align: center;
        }

        /* ── Sick Leave Specific Vertical Rhythm (Golden Mean: ~13.8pt - 14pt balanced typography) ── */
        .sick-leave-doc .doc-title {
          margin: 12px 0 14px;
          font-size: 17pt;
        }

        .sick-leave-doc .doc-intro {
          margin-top: 10px;
          margin-bottom: 6px;
          font-size: 14pt;
          font-weight: bold;
        }

        .sick-leave-doc .doc-whereas {
          margin-bottom: 7px;
          font-size: 13.8pt;
          line-height: 1.56;
        }

        .sick-leave-doc .doc-decides {
          margin: 12px 0 14px;
          font-size: 14.5pt;
          font-weight: bold;
        }

        .sick-leave-doc .doc-article {
          margin-bottom: 0;
        }

        .sick-leave-doc .doc-sick-article-block {
          margin-bottom: 15px;
          font-size: 13.8pt;
          line-height: 1.58;
          text-align: justify;
          color: #000000 !important;
          opacity: 1 !important;
          font-weight: normal !important;
        }

        .sick-leave-doc .doc-sick-article-block strong {
          font-weight: bold !important;
          font-size: 14.5pt !important;
          color: #000000 !important;
          opacity: 1 !important;
        }

        .sick-leave-doc .doc-signature {
          margin-top: 15px;
          margin-bottom: 8px;
          width: 260px;
          margin-left: 14px;
          margin-right: auto;
          margin-inline-start: auto;
          margin-inline-end: 14px;
        }

        .sick-leave-doc .doc-stamp-area {
          height: 17mm; /* ~1.7cm comfortable clearance for circular ink stamp and physical signature */
        }

        .sick-leave-doc .doc-signature-place {
          font-size: 13.5pt;
        }

        .sick-leave-doc .doc-signature-title {
          font-size: 14pt;
          font-weight: bold;
        }

        .doc-warning {
          background: #FEF3C7;
          border: 2px solid #F59E0B;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 8px;
          font-size: 12px;
          color: #92400E;
          font-family: sans-serif;
        }
      `}</style>

      {/* ── Validation Warnings ── */}
      {warnings.length > 0 && (
        <div>
          {warnings.map((w, i) => (
            <div key={i} className="doc-warning">⚠ {w}</div>
          ))}
        </div>
      )}

      {/* ══════════════ HEADER ══════════════ */}
      <div style={{ width: "100%", display: "block", marginBottom: "6px" }}>
        {/* 1. TOP CENTER: Republic & Ministry */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "6px",
            fontFamily: '"Amiri", "Traditional Arabic", Arial, sans-serif',
            fontSize: "13pt",
            fontWeight: "bold",
            lineHeight: "1.35",
            color: "#000",
          }}
        >
          <div>الجمهورية الجزائرية الديمقراطية الشعبية</div>
          <div>وزارة المالية</div>
        </div>

        {/* 2. SPLIT COLUMNS: Forced LTR container ensures left/right stay in place */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
            direction: "ltr",
          }}
        >
          {/* LEFT SIDE: QR & Reference */}
          <div
            dir="ltr"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              width: "130px",
              minWidth: "120px",
              direction: "ltr",
            }}
          >
            {qrPayload && <QRCode value={qrPayload} size={64} level="M" />}
            {referenceCode && (
              <div
                dir="ltr"
                style={{
                  marginTop: "4px",
                  fontSize: "7.5pt",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontWeight: "600",
                  letterSpacing: "-0.3px",
                  whiteSpace: "nowrap",
                  overflow: "visible",
                  display: "block",
                  textAlign: "center",
                  width: "auto",
                  minWidth: "100%",
                  direction: "ltr",
                }}
              >
                {referenceCode}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Directorates Hierarchy & Ref Number */}
          <div
            style={{
              textAlign: "right",
              direction: "rtl",
              fontFamily: '"Amiri", "Traditional Arabic", Arial, sans-serif',
              fontSize: "13pt",
              fontWeight: "bold",
              lineHeight: "1.45",
              color: "#000",
            }}
          >
            <div>المديرية العامة للأملاك الوطنية</div>
            <div>
              المديرية الجهوية للأملاك الوطنية{" "}
              {header.wilaya
                ? header.wilaya.startsWith("ال")
                  ? `ب${header.wilaya}`
                  : `بـ${header.wilaya}`
                : "بالشلف"}
            </div>
            <div>المديرية الفرعية للإدارة العامة</div>

            <div style={{ marginTop: "6px", fontSize: "12pt", fontWeight: "bold", fontFamily: "inherit" }}>
              رقم:{" "}
              {header.referenceNumber ? (
                <LTR>{header.referenceNumber}</LTR>
              ) : (
                "................... /م.ج.أ.و.ش/"
              )}
              {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ TITLE ══════════════ */}
      <div className="doc-title">{isMaternityLeave ? "مقرر عطلة أمومة" : (isSickLeave ? "مقرر عطلة مرضية" : "سند عطلة سنوية")}</div>

      {/* ══════════════ OPENING ══════════════ */}
      <div className="doc-intro">إن وزير المالية،</div>

      {/* ══════════════ LEGAL REFERENCES ══════════════ */}
      {isDecisionDoc ? (
        <>
          <p className="doc-whereas">- {SICK_LEAVE_SOCIAL_SECURITY_LAW}</p>
          <p className="doc-whereas">- {resolvedCorpsType === "contractual" ? CONTRACTUAL_STAFF_DECREE : CIVIL_SERVICE_ORDINANCE}</p>
          <p className="doc-whereas">
            - وبمقتضى مقرر تعيين {g.title}{" "}
            <strong>{formattedEmployeeName}</strong> {g.bisifat}{" "}
            <strong>{employee.rank}</strong> لدى {directorateName}،
          </p>
          {/* First Medical Certificate */}
          <p className="doc-whereas">
            - وبعد الإطلاع على الشهادة الطبية الصادرة عن{" "}
            {data.doctorName ? (
              <strong>{data.doctorName}</strong>
            ) : (
              <strong>الطبيب المعالج</strong>
            )}{" "}
            والمؤرخة في{" "}
            {data.certificateDate ? (
              <AdminDate value={data.certificateDate} dateInput={data.certificateDate} />
            ) : (
              "............."
            )}،
          </p>

          {/* Optional Second Medical Certificate */}
          {(data.hasSecondCertificate || data.secondDoctorName || data.secondCertificateDate) && (data.secondCertificateDate || data.secondDoctorName) && (
            <p className="doc-whereas">
              - وبناء على الشهادة الطبية الصادرة عن{" "}
              {data.secondDoctorName ? (
                <strong>{data.secondDoctorName}</strong>
              ) : data.doctorName ? (
                <strong>{data.doctorName}</strong>
              ) : (
                <strong>الطبيب المعالج</strong>
              )}{" "}
              والمؤرخة في{" "}
              <AdminDate value={data.secondCertificateDate} dateInput={data.secondCertificateDate} />،
            </p>
          )}

          {/* Proposal Preamble */}
          <p className="doc-whereas">{SICK_LEAVE_PROPOSAL}</p>
        </>
      ) : (
        <>
          <p className="doc-whereas">
            - بمقتضى القانون رقم 81-08 المؤرخ في 27 جوان سنة 1981 المتعلق بالعطل السنوية،
          </p>
          <p className="doc-whereas">- {legal.decreeText}</p>
          <p className="doc-whereas">
            - وبمقتضى المرسوم التنفيذي رقم 21-393 المؤرخ في 18 أكتوبر سنة 2021، يحدد تنظيم المصالح
            الخارجية للمديرية العامة للأملاك الوطنية وصلاحياتها،
          </p>
          <p className="doc-whereas">
            - وبناءا على المقرر المتضمن تعيين {g.title}{" "}
            <strong>{formattedEmployeeName}</strong> {g.bisifat}{" "}
            <strong>{employee.rank}</strong> لدى {directorateName}،
          </p>
          <p className="doc-whereas">
            - وبعد الإطلاع على الطلب المحرر من طرف {g.maani} المتضمن طلب العطلة السنوية بعنوان سنة{" "}
            <LTR>{leave.year}</LTR>
          </p>
          <p className="doc-whereas">- وباقتراح من السيد المدير الفرعي للإدارة العامة.</p>
        </>
      )}

      {/* ══════════════ DECISION ══════════════ */}
      <div className="doc-decides">{isDecisionDoc ? "يـقـرر ما يلي :" : "يـقـرر :"}</div>

      {/* ══════════════ ARTICLES / BODY ══════════════ */}
      {isDecisionDoc ? (
        <div className="doc-article" style={{ color: "#000000" }}>
          <div className="doc-sick-article-block" style={{ color: "#000000", opacity: 1, fontWeight: "normal" }}>
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>المادة الأولى :</strong> تمنح{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>{isMaternityLeave ? "عطلة أمومة" : "عطلة مرضية"}</strong> مدتها{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>
              {leave.daysInWords} (<LTR>{leave.days}</LTR>) يوم
            </strong>{" "}
            متتالية لفائدة {g.title}{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>{formattedEmployeeName}</strong> {g.bisifat}{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>{employee.rank}</strong> لدى {directorateName}، إبتداءا من تاريخ{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>
              <AdminDate dateInput={leave.startDate} value={leave.startDate} />
            </strong>{" "}
            إلى غاية{" "}
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>
              <AdminDate dateInput={leave.endDate} value={leave.endDate} />
            </strong>.
          </div>

          <div className="doc-sick-article-block" style={{ color: "#000000", opacity: 1, fontWeight: "normal" }}>
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>المادة الثانية :</strong> يقتطع من مرتب {g.maani} المدة المذكورة في المادة الأولى من هذا المقرر.
          </div>

          <div className="doc-sick-article-block" style={{ color: "#000000", opacity: 1, fontWeight: "normal" }}>
            <strong style={{ color: "#000000", opacity: 1, fontWeight: "bold" }}>المادة الثالثة :</strong> يكلف السيد المدير الفرعي للإدارة العامة بتنفيذ هذا المقرر.
          </div>
        </div>
      ) : (
        <div className="doc-article">
          <div className="doc-article-line">
            <strong>المادة الوحيدة :</strong> تمنح عطلة سنوية مدفوعة الأجر مدتها{" "}
            <strong>{leave.daysInWords}</strong> (<strong><LTR>{leave.days}</LTR></strong>) يوم.
          </div>
          <div className="doc-article-line">
            <strong>السنة:</strong> <strong><LTR>{leave.year}</LTR></strong>
          </div>
          <div className="doc-article-line">
            <strong>{employee.gender === "female" ? "للسيدة" : "للسيد"} :</strong> <strong>{formattedEmployeeName}</strong>
          </div>
          <div className="doc-article-line">
            <strong>الرتبة:</strong> <strong>{employee.rank}</strong>
          </div>
          <div className="doc-article-line">
            <strong>الوظيفة:</strong> <strong>{employee.jobTitle || "غير محدد"}</strong>
          </div>
          <div className="doc-article-line">
            <strong>الفترة :</strong> من <strong><AdminDate dateInput={leave.startDate} /></strong> إلى <strong><AdminDate dateInput={leave.endDate} /></strong>
          </div>
          <div className="doc-note-line">
            - العنوان الشخصي للمستفيد(ة) ولاية <strong>{employee.province || "الشلف"}</strong>
          </div>
          <div className="doc-note-line">
            <span>- {g.yastanif} يوم </span>
            <strong><AdminDate dateInput={resumeDateToDisplay} value={resumeDateToDisplay} /></strong>
            <span>، لذا {g.alayh} إبلاغنا بتاريخ الالتحاق {g.bimansibihi} في نفس اليوم.</span>
          </div>
        </div>
      )}

      {/* ══════════════ REMAINING BALANCE (ANNUAL LEAVE ONLY) ══════════════ */}
      {!isDecisionDoc && leave.remaining?.length > 0 && (
        <div className="doc-remark" style={{ marginTop: "6px", marginBottom: "4px", fontWeight: "bold" }}>
          <span className="doc-remark-label">ملاحظة :</span> تبقى{" "}
          {leave.remaining.map((r, i) => (
            <React.Fragment key={r.year}>
              {i > 0 && " و "}
              <strong>{r.daysInWords}</strong> (<strong><LTR>{r.days}</LTR></strong>) يوم من{" "}
              {i === 0 ? "العطلة السنوية" : "سنة"} (<strong><LTR>{r.year}</LTR></strong>)
            </React.Fragment>
          ))}
          .
        </div>
      )}

      {/* ══════════════ REMARKS / NOTES ══════════════ */}
      {leave.notes && (
        <div className="doc-remark" style={{ marginTop: "6px", marginBottom: "4px", fontWeight: "bold" }}>
          <span className="doc-remark-label">الملاحظات :</span> {leave.notes}
        </div>
      )}

      {/* ══════════════ SIGNATURE & STAMP BLOCK ══════════════ */}
      <div className="doc-signature">
        <div className="doc-signature-place">
          حرر{" "}
          {signature.place
            ? signature.place.startsWith("ال")
              ? `ب${signature.place}`
              : `بـ${signature.place}`
            : "بالشلف"}{" "}
          في {signature.date ? formatAlgerianAdministrativeDate(signature.date) : "............."}
        </div>
        <div className="doc-stamp-area" />
        <div className="doc-signature-title">
          {isDecisionDoc
            ? SICK_LEAVE_SIGNATORY_TITLE
            : (signature?.title && signature.title !== "المدير" && signature.title !== "المدير الجهوي" ? signature.title : ANNUAL_LEAVE_SIGNATORY_TITLE)}
        </div>
      </div>
    </div>
  );
}
