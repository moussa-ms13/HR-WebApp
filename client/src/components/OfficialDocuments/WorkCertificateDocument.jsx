import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import {
  formatOfficialDateYMD,
  getOfficialGenderPhrasing,
  buildWorkCertificateQrPayload,
  generateOfficialRefCode,
} from "./officialDocumentUtils";

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

/**
 * Formats birthplace directly attached to preposition "ب" without parentheses or tatweel
 * (e.g. "الشلف" -> "بالشلف", "تيارت" -> "بتيارت").
 */
function formatAttachedBirthPlace(rawPlace) {
  const cleaned = String(rawPlace || "")
    .replace(/[()]/g, "")
    .trim();
  if (!cleaned) return "بـ ............";
  if (cleaned.startsWith("بـ")) {
    return `ب${cleaned.slice(2).trim()}`;
  }
  if (cleaned.startsWith("بال")) {
    return cleaned;
  }
  return `ب${cleaned}`;
}

/**
 * LtrDate — Renders YYYY/MM/DD dates in strict LTR order while inheriting the exact
 * font family, font size, and baseline of the surrounding Arabic text.
 */
const LtrDate = ({ value, bold = true }) => (
  <span
    dir="ltr"
    style={{
      display: "inline-block",
      direction: "ltr",
      unicodeBidi: "isolate",
      fontFamily: "inherit",
      fontSize: "inherit",
      lineHeight: "inherit",
      fontWeight: bold ? "bold" : "inherit",
      color: "#000000",
    }}
  >
    {`\u2066${value}\u2069`}
  </span>
);

/**
 * WorkCertificateDocument — 100% Faithful Replica of Official Algerian "شهادة عمل" (1000114403.jpg)
 * Strictly calibrated to fit cleanly on 1 single A4 page with top-left QR code.
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

  const formattedBirthDate = formatOfficialDateYMD(birthDate, "..../../..");
  const formattedHireDate = formatOfficialDateYMD(firstHireDate, "..../../..");
  const formattedIssueDate = formatOfficialDateYMD(issueDate, "..../../..");
  const displayRefNum = String(refNumber || "").trim() || "............";
  const displayYear = year || new Date().getFullYear();
  const presentPhrase = g.isFemale ? "و هي متواجدة" : "و هو متواجد";

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
        padding: "14mm 15mm 18mm 15mm",
        boxSizing: "border-box",
        fontFamily: "'Traditional Arabic', 'Amiri', 'Times New Roman', serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ══════════════ HEADER BLOCK ══════════════ */}
      <div
        style={{
          textAlign: "center",
          fontSize: "18pt",
          fontWeight: "bold",
          color: "#000000",
          marginBottom: "6mm",
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
          marginBottom: "12mm",
        }}
      >
        {/* TOP LEFT: QR Code + Issue Date */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            minWidth: "160px",
          }}
        >
          <DocumentQrBadge payload={qrPayload} referenceCode={qrRefCode} size={84} />
          <div
            dir="rtl"
            style={{
              fontSize: "14pt",
              fontWeight: "bold",
              color: "#000000",
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
            fontSize: "13.5pt",
            fontWeight: "bold",
            lineHeight: "1.45",
            color: "#000000",
          }}
        >
          <div>وزارة المالية</div>
          <div>المديرية العامة للأملاك الوطنية</div>
          <div>المديرية الجهوية للأملاك الوطنية بالشلف</div>
          <div>المديرية الفرعية للإدارة العامة</div>
          <div style={{ marginTop: "6px", fontSize: "13.5pt" }}>
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

      {/* ══════════════ TITLE BOX (شهـــــادة عمـــــل) ══════════════ */}
      <div style={{ textAlign: "center", marginBottom: "14mm" }}>
        <div
          style={{
            width: "58%",
            margin: "0 auto",
            padding: "6px 24px",
            border: "1.5px solid #000000",
            borderRadius: "10px",
            backgroundColor: "#e2e5ea",
            boxShadow: "2px 3px 0px rgba(0,0,0,0.22)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "22pt",
              fontWeight: "bold",
              color: "#000000",
              textDecoration: "none",
            }}
          >
            شهـــــادة عمـــــل
          </span>
        </div>
      </div>

      {/* ══════════════ OPENING AUTHORITY LINE ══════════════ */}
      <p
        style={{
          width: "100%",
          paddingRight: "16mm",
          fontSize: "17pt",
          fontWeight: "bold",
          lineHeight: "1.8",
          textAlign: "right",
          whiteSpace: "nowrap",
          wordSpacing: "normal",
          color: "#000000",
          margin: 0,
        }}
      >
        {signatory.openingLine}
      </p>

      {/* ══════════════ MAIN BODY PARAGRAPH ══════════════ */}
      <p
        style={{
          width: "100%",
          marginTop: "14px",
          marginBottom: 0,
          fontSize: "16.5pt",
          lineHeight: "2.15",
          textAlign: "justify",
          textAlignLast: "right",
          wordSpacing: "normal",
          color: "#000000",
        }}
      >
        بأن {g.title}{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {fullName || "........................."}
        </strong>{" "}
        {g.born} بتاريخ <LtrDate value={formattedBirthDate} bold />{" "}
        {formatAttachedBirthPlace(birthPlace)}، {g.practices} {g.asRole}{" "}
        <strong style={{ fontWeight: "bold", color: "#000000" }}>
          {jobTitle || "........................."}
        </strong>{" "}
        لدى {directorate || "المديرية الجهوية للأملاك الوطنية بالشلف"} {presentPhrase} ضمن
        المستخدمين منذ تاريخ <LtrDate value={formattedHireDate} bold /> إلى غاية يومنا هذا.
      </p>

      {/* ══════════════ CLOSING SENTENCE ══════════════ */}
      <p
        style={{
          marginTop: "26px",
          marginBottom: 0,
          paddingRight: "18mm",
          fontSize: "15.5pt",
          fontWeight: 700,
          lineHeight: "1.9",
          textAlign: "right",
          color: "#000000",
        }}
      >
        سلمت {g.toHimHer} هذه الشهادة بناءً على {g.hisHerRequest} وذلك للإدلاء بها فيما
        يسمح به القانون.
      </p>

      {/* ══════════════ SIGNATURE BLOCK (LEFT) ══════════════ */}
      <div
        style={{
          marginTop: "32px",
          paddingRight: "58%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "17pt",
            fontWeight: "bold",
            color: "#000000",
          }}
        >
          {signatory.signatureTitle}
        </div>
      </div>

      {/* ══════════════ FOOTER (نسخة إلى:) ══════════════ */}
      <div
        style={{
          marginTop: "auto",
          paddingBottom: "10mm",
          textAlign: "right",
          fontSize: "12pt",
          lineHeight: "1.6",
          color: "#000000",
        }}
      >
        <div
          style={{
            borderTop: "1px solid #000000",
            width: "95px",
            paddingTop: "4px",
            fontWeight: "bold",
            marginBottom: "2px",
          }}
        >
          نسخة إلى:
        </div>
        <div>- المعني(ة).</div>
        <div>- الملف الإداري.</div>
      </div>
    </div>
  );
}
