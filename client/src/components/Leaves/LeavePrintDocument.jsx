import React from "react";
import { QRCodeSVG as QRCode } from "qrcode.react";
import {
  getGenderProfile,
  LEGAL_PROFILES,
  LEAVE_TYPES_LEGEND,
} from "../../utils/leaveCertificateConfig";

/* ── LTR wrapper for numbers/dates inside RTL context ── */
const LTR = ({ children }) => (
  <span dir="ltr" style={{ unicodeBidi: "embed" }}>
    {children}
  </span>
);

/**
 * LeavePrintDocument — Official Annual Leave Certificate (سند عطلة سنوية)
 *
 * Renders a pixel-faithful reproduction of the DOCX template.
 * Designed to be rendered inside an isolated iframe for clean printing.
 *
 * Props contract (normalized data):
 *   corpsType:    "common" | "special"
 *   genderProfile: object from getGenderProfile()
 *   header:       { wilaya, subDirectorate, referenceNumber }
 *   employee:     { name, gender, dateOfBirth, rank, jobTitle, province }
 *   decision:     { directorateName }
 *   leave:        { year, days, daysInWords, startDate, endDate, resumeDate, remaining }
 *   signature:    { place, date }
 *   qrPayload:    string (offline text for QR code)
 *   referenceCode: string
 *   warnings:     string[] (validation warnings to show)
 */
export default function LeavePrintDocument({
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
}) {
  const legal = LEGAL_PROFILES[corpsType] ?? LEGAL_PROFILES.common;
  const g = genderProfile || getGenderProfile("male"); // fallback to male if somehow null

  return (
    <div className="leave-doc-page" dir="rtl" style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: '14pt', lineHeight: '1.8' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

        @page {
          size: A4;
          margin: 5mm 15mm 15mm 15mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .leave-doc-page {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        .leave-doc-page {
          width: 100%;
          box-sizing: border-box;
          font-family: 'Amiri', 'Traditional Arabic', 'Tahoma', serif;
          color: #111;
          font-size: 14.5px;
          line-height: 1.7;
          direction: rtl;
        }
        .leave-doc-page * {
          box-sizing: border-box;
        }
        @media screen {
          .leave-doc-page {
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 12mm 15mm;
            background: #fff;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
            overflow: hidden;
          }
        }

        /* ── Header ── */
        .doc-header {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .doc-republic {
          text-align: center;
          font-weight: bold;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .doc-header-row {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }
        /* Ministry block — full hierarchy on the RIGHT side */
        .doc-ministry-block {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        .doc-ministry-block div {
          white-space: nowrap;
          font-size: 13.5px;
        }
        .doc-ministry-block .doc-subdirectorate {
          font-size: 13.5px;
          white-space: nowrap;
        }
        .doc-ministry-block .doc-refnum {
          font-size: 13px;
          margin-top: 3px;
          white-space: nowrap;
        }
        /* QR-only left block */
        .doc-left-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          min-width: 128px;
        }
        .doc-qr-wrap {
          flex-shrink: 0;
          width: 128px;
          height: 128px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Title ── */
        .doc-title {
          text-align: center;
          font-weight: bold;
          font-size: 18px;
          text-decoration: underline;
          margin: 10px 0 14px;
        }

        /* ── Legal section ── */
        .doc-intro {
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 15px;
        }
        .doc-whereas {
          margin: 0 0 6px;
          padding-right: 18px;
          text-indent: -18px;
          text-align: justify;
          font-size: 14px;
          line-height: 1.65;
        }

        /* ── Decision ── */
        .doc-decides {
          text-align: center;
          font-weight: bold;
          margin: 14px 0;
          letter-spacing: 2px;
          font-size: 16px;
        }

        /* ── Article ── */
        .doc-article {
          margin-bottom: 6px;
        }
        .doc-article-line {
          margin: 5px 0;
          font-size: 14.5px;
        }
        .doc-article-line strong {
          font-weight: bold;
        }
        .doc-note-line {
          margin: 4px 0;
          font-size: 14px;
        }

        /* ── Remark ── */
        .doc-remark {
          margin-top: 10px;
          font-size: 14px;
        }
        .doc-remark-label {
          font-weight: bold;
          text-decoration: underline;
        }

        /* ── Signature ── */
        .doc-signature {
          margin-top: 28px;
          text-align: left;
          padding-left: 50px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .doc-signature-place {
          margin-bottom: 18px;
          font-size: 14.5px;
        }
        .doc-signature-title {
          font-weight: bold;
          font-size: 15px;
        }

        /* ── Footer Legend ── */
        .doc-legend {
          margin-top: 20px;
          text-align: left;
          font-style: italic;
          font-size: 11.5px;
          color: #444;
        }

        /* ── Warnings ── */
        .doc-warning {
          background: #FEF3C7;
          border: 2px solid #F59E0B;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          font-size: 13px;
          color: #92400E;
          font-family: 'Cairo', sans-serif;
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

      {/* ══════════════ HEADER (BULLETPROOF INLINE STYLES FOR PRINT) ══════════════ */}
      <div className="mb-6" style={{ width: '100%', display: 'block' }}>
        
        {/* 1. TOP CENTER: Republic & Ministry */}
        <div style={{ textAlign: 'center', marginBottom: '24px', fontFamily: '"Traditional Arabic", "Amiri", "hf", serif', fontSize: '15pt', fontWeight: 'bold', lineHeight: '1.5' }}>
          <div>الجمهورية الجزائرية الديمقراطية الشعبية</div>
          <div>وزارة المالية</div>
        </div>

        {/* 2. SPLIT COLUMNS: Forced LTR container ensures left/right stay in place */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', direction: 'ltr' }}>
          
          {/* LEFT SIDE: QR & Reference (First child in LTR is always Left) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '120px' }}>
            {qrPayload && (
              <QRCode value={qrPayload} size={70} level="M" />
            )}
            {referenceCode && (
              <div style={{ marginTop: '8px', fontSize: '10px', fontFamily: 'Consolas, monospace', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {referenceCode}
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Directorates (Second child in LTR is always Right, uses internal RTL) */}
          <div style={{ textAlign: 'right', direction: 'rtl', fontFamily: '"Traditional Arabic", "Amiri", "hf", serif', fontSize: '14pt', fontWeight: 'bold', lineHeight: '1.6' }}>
            <div>المديرية العامة للأملاك الوطنية</div>
            <div>المديرية الجهوية للأملاك الوطنية بـ{header.wilaya}</div>
            <div>المديرية الفرعية للإدارة العامة</div>
            
            <div style={{ marginTop: '16px', fontFamily: 'Calibri, sans-serif' }}>
              رقم: {header.referenceNumber ? <LTR>{header.referenceNumber}</LTR> : "................... /م.ج.أ.و.ش/"}{new Date().getFullYear()}
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════ TITLE ══════════════ */}
      <div className="doc-title">سند عطلة سنوية</div>

      {/* ══════════════ OPENING ══════════════ */}
      <div className="doc-intro">إن وزير المالية،</div>

      {/* ══════════════ LEGAL REFERENCES ══════════════ */}
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
        <strong>{employee.name}</strong> {g.bisifat}{" "}
        <strong>{employee.rank}</strong> لدى {decision.directorateName}،
      </p>
      <p className="doc-whereas">
        - وبعد الإطلاع على الطلب المحرر من طرف {g.maani} المتضمن طلب العطلة السنوية بعنوان سنة{" "}
        <LTR>{leave.year}</LTR>
      </p>
      <p className="doc-whereas">- وباقتراح من السيد المدير الفرعي للإدارة العامة.</p>

      {/* ══════════════ DECISION ══════════════ */}
      <div className="doc-decides">*** يـقـرر ***</div>

      {/* ══════════════ ARTICLE ══════════════ */}
      <div className="doc-article">
        <div className="doc-article-line">
          <strong>المادة الوحيدة :</strong> تمنح عطلة سنوية مدفوعة الأجر مدتها{" "}
          <strong>{leave.daysInWords}</strong> (<LTR>{leave.days}</LTR>) يوم.
        </div>
        <div className="doc-article-line">
          <strong>السنة:</strong> <LTR>{leave.year}</LTR>
        </div>
        <div className="doc-article-line">
          <strong>{employee.gender === 'female' ? 'للسيدة' : 'للسيد'} :</strong> {employee.name}
        </div>
        <div className="doc-article-line">
          <strong>الرتبة:</strong> {employee.rank}
        </div>
        <div className="doc-article-line">
          <strong>الوظيفة:</strong> {employee.jobTitle || "/"}
        </div>
        <div className="doc-article-line">
          <strong>الفترة:</strong> <LTR>{leave.startDate}</LTR> إلى <LTR>{leave.endDate}</LTR>
        </div>
        <div className="doc-note-line">
          - العنوان الشخصي للمستفيد(ة) ولاية {employee.province}
        </div>
        <div className="doc-note-line">
          - {g.yastanif} يوم <LTR>{leave.resumeDate}</LTR>، لذا {g.alayh} إبلاغنا بتاريخ الالتحاق{" "}
          {g.bimansibihi} في نفس اليوم.
        </div>
      </div>

      {/* ══════════════ REMAINING BALANCE ══════════════ */}
      {leave.remaining?.length > 0 && (
        <div className="doc-remark" style={{ marginTop: '30px', marginBottom: '10px', fontWeight: 'bold' }}>
          <span className="doc-remark-label">ملاحظة :</span>{" "}تبقى{" "}
          {leave.remaining.map((r, i) => (
            <React.Fragment key={r.year}>
              {i > 0 && " و "}
              <strong>{r.daysInWords}</strong> (<LTR>{r.days}</LTR>) يوم من{" "}
              {i === 0 ? "العطلة السنوية" : "سنة"} (<LTR>{r.year}</LTR>)
            </React.Fragment>
          ))}
          .
        </div>
      )}

      {/* ══════════════ REMARKS / NOTES ══════════════ */}
      {leave.notes && (
        <div className="doc-remark" style={{ marginTop: '10px', marginBottom: '20px', fontWeight: 'bold' }}>
          <span className="doc-remark-label">الملاحظات :</span> {leave.notes}
        </div>
      )}

      {/* ══════════════ SIGNATURE ══════════════ */}
      <div className="doc-signature">
        <div className="doc-signature-place">
          حرر بـ{signature.place || "الشلف"} في{" "}
          {signature.date ? <LTR>{signature.date}</LTR> : "............."}
        </div>
        <div className="doc-signature-title">المدير</div>
      </div>

    </div>
  );
}
