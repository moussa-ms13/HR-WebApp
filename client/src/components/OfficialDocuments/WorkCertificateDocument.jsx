import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import {
  getOfficialGenderPhrasing,
  buildWorkCertificateQrPayload,
  generateOfficialRefCode,
} from "./officialDocumentUtils";

/**
 * Formats dates strictly as YYYY/MM/DD (e.g., 2001/07/01, 2024/05/02, 2026/11/22),
 * ignoring sentinel SQL dates (year <= 1900).
 */
function formatDateYMD(dateInput, fallback = "..../../..") {
  if (!dateInput) return fallback;
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return fallback;
    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const year = parseInt(dmyMatch[3], 10);
      if (year <= 1900) return fallback;
      return `${year}/${dmyMatch[2].padStart(2, "0")}/${dmyMatch[1].padStart(2, "0")}`;
    }
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      if (year <= 1900) return fallback;
      return `${year}/${ymdMatch[2].padStart(2, "0")}/${ymdMatch[3].padStart(2, "0")}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return fallback;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export const WORK_CERT_SIGNATORIES = {
  sub_director: {
    id: "sub_director",
    label: "المدير الفرعي (الافتراضي)",
    openingLine: "نحن المدير الفرعي للإدارة العامة للأملاك الوطنية بالشلف، نشهد",
    signatureTitle: "المدير الفرعي",
  },
  regional_director: {
    id: "regional_director",
    label: "المدير الجهوي للأملاك الوطنية بالشلف",
    openingLine: "نحن المدير الجهوي للأملاك الوطنية بالشلف، نشهد",
    signatureTitle: "المدير الجهوي",
  },
};

const LtrDate = ({ value }) => (
  <span
    dir="ltr"
    style={{
      display: "inline-block",
      direction: "ltr",
      unicodeBidi: "isolate",
      fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
      fontWeight: "bold",
    }}
  >
    {`\u2066${value}\u2069`}
  </span>
);

/**
 * WorkCertificateDocument — Official Printable A4 "شهادة عمل"
 * Strictly calibrated to fit cleanly on 1 single A4 page.
 */
export default function WorkCertificateDocument({
  employeeId,
  fullName = "",
  gender = "",
  birthDate = "",
  birthPlace = "",
  jobTitle = "",
  directorate = "",
  firstHireDate = "",
  refNumber = "",
  year = new Date().getFullYear(),
  issueDate = "",
  signatoryKey = "sub_director",
}) {
  const g = getOfficialGenderPhrasing(gender);
  const signatory =
    WORK_CERT_SIGNATORIES[signatoryKey] || WORK_CERT_SIGNATORIES.sub_director;

  const formattedBirthDate = formatDateYMD(birthDate, "..../../..");
  const formattedHireDate = formatDateYMD(firstHireDate, "..../../..");
  const formattedIssueDate = formatDateYMD(issueDate, "..../../..");
  const displayRefNum = String(refNumber || "").trim() || ".............";
  const displayYear = year || new Date().getFullYear();

  const qrPayload = buildWorkCertificateQrPayload({
    refNumber: String(refNumber || "").trim(),
    year: displayYear,
    issueDate,
    employeeId,
    fullName,
    jobTitle,
    directorate,
    firstHireDate,
  });

  const qrRefCode = generateOfficialRefCode("WC", employeeId, refNumber, displayYear);

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
        padding: "16mm 15mm 20mm 15mm",
        boxSizing: "border-box",
        fontFamily: '"Amiri", "Traditional Arabic", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ══════════════ TOP CONTENT ══════════════ */}
      <div>
        {/* Top Center Republic Header */}
        <div
          style={{
            textAlign: "center",
            fontSize: "15pt",
            fontWeight: "bold",
            marginBottom: "10mm",
            letterSpacing: "0.3px",
          }}
        >
          الجمهورية الجزائرية الديمقراطية الشعبية
        </div>

        {/* Split Header: Top Right (Hierarchy & Ref) + Top Left (QR + Date) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            direction: "ltr",
            marginBottom: "18mm",
          }}
        >
          {/* TOP LEFT: QR Code + Issue Date */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              minWidth: "150px",
            }}
          >
            <DocumentQrBadge payload={qrPayload} referenceCode={qrRefCode} size={66} />
            <div
              dir="rtl"
              style={{
                fontSize: "13pt",
                fontWeight: "bold",
                marginTop: "2px",
                whiteSpace: "nowrap",
              }}
            >
              الشلف، في:{" "}
              {issueDate ? <LtrDate value={formattedIssueDate} /> : "........................."}
            </div>
          </div>

          {/* TOP RIGHT: Ministry & Directorate Hierarchy */}
          <div
            dir="rtl"
            style={{
              textAlign: "right",
              fontSize: "13pt",
              fontWeight: "bold",
              lineHeight: "1.65",
            }}
          >
            <div>وزارة المالية</div>
            <div>المديرية العامة للأملاك الوطنية</div>
            <div>المديرية الجهوية للأملاك الوطنية بالشلف</div>
            <div>المديرية الفرعية للإدارة العامة</div>
            <div style={{ marginTop: "6px", fontSize: "12.5pt" }}>
              رقم:{" "}
              <span dir="ltr" style={{ display: "inline-block", unicodeBidi: "isolate" }}>
                {displayRefNum}
              </span>{" "}
              / م.ج.أ.و.ش /{" "}
              <span dir="ltr" style={{ display: "inline-block", unicodeBidi: "isolate" }}>
                {displayYear}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER TITLE: Framed Bold & Underlined */}
        <div style={{ textAlign: "center", marginBottom: "18mm" }}>
          <div
            style={{
              display: "inline-block",
              padding: "8px 56px 12px 56px",
              border: "1.5px solid #1f2937",
              borderRadius: "8px",
              backgroundColor: "#f3f4f6",
              boxShadow: "3px 3px 0px #9ca3af",
            }}
          >
            <span
              style={{
                fontSize: "22pt",
                fontWeight: "bold",
                textDecoration: "underline",
                textUnderlineOffset: "5px",
                letterSpacing: "1px",
                color: "#000000",
              }}
            >
              شهادة عمل
            </span>
          </div>
        </div>

        {/* OPENING SIGNATORY */}
        <p
          style={{
            fontSize: "15pt",
            fontWeight: "bold",
            lineHeight: "2.1",
            marginBottom: "10mm",
            textAlign: "right",
            textIndent: "10mm",
          }}
        >
          {signatory.openingLine}
        </p>

        {/* MAIN BODY */}
        <p
          style={{
            width: "100%",
            fontSize: "15pt",
            lineHeight: "2.35",
            textAlign: "justify",
            marginBottom: "12mm",
            color: "#111827",
          }}
        >
          بأن {g.title}{" "}
          <strong style={{ fontSize: "15.5pt", color: "#000000" }}>
            {fullName || "........................."}
          </strong>{" "}
          {g.born} بتاريخ <LtrDate value={formattedBirthDate} />{" "}
          <span dir="rtl" style={{ unicodeBidi: "isolate" }}>
            بـ (<strong>{birthPlace || "..............."}</strong>)
          </span>
          ، {g.practices} {g.asRole}{" "}
          <strong style={{ color: "#000000" }}>
            {jobTitle || "........................."}
          </strong>{" "}
          لدى{" "}
          <strong style={{ color: "#000000" }}>
            {directorate || "المديرية الجهوية للأملاك الوطنية بالشلف"}
          </strong>{" "}
          {g.present} ضمن المستخدمين منذ تاريخ{" "}
          <LtrDate value={formattedHireDate} /> إلى غاية يومنا هذا.
        </p>

        {/* CLOSING SENTENCE */}
        <p
          style={{
            fontSize: "15pt",
            lineHeight: "2.1",
            textAlign: "right",
            textIndent: "10mm",
            marginBottom: "20mm",
            color: "#111827",
          }}
        >
          سلمت {g.toHimHer} هذه الشهادة بناءً على {g.hisHerRequest} وذلك للإدلاء بها فيما
          يسمح به القانون.
        </p>

        {/* SIGNATURE AREA (LEFT) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingLeft: "14mm",
          }}
        >
          <div style={{ width: "260px", textAlign: "center" }}>
            <div style={{ fontSize: "15pt", fontWeight: "bold", color: "#000000" }}>
              {signatory.signatureTitle}
            </div>
            <div style={{ height: "18mm" }} />
          </div>
        </div>
      </div>

      {/* ══════════════ BOTTOM RIGHT COPIES FOOTER ══════════════ */}
      <div
        style={{
          textAlign: "right",
          fontSize: "12pt",
          lineHeight: "1.7",
          color: "#1f2937",
          paddingTop: "6mm",
          marginBottom: "14mm",
        }}
      >
        <div style={{ fontWeight: "bold", textDecoration: "underline", marginBottom: "2px" }}>
          نسخة إلى:
        </div>
        <div>- المعني(ة)</div>
        <div>- الملف الإداري</div>
      </div>
    </div>
  );
}
