import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import {
  formatOfficialDateYMD,
  generateOfficialRefCode,
} from "./officialDocumentUtils";

export const WORK_DECL_SIGNATORIES = {
  sub_director: {
    id: "sub_director",
    label: "المدير الفرعي للإدارة العامة (الافتراضي)",
    openingLine:
      "أنا الموقع أدناه المدير الفرعي للإدارة العامة بالمديرية الجهوية للأملاك الوطنية بالشلف أصرح بأن:",
    signatureTitle: "المدير الفرعي",
  },
  regional_director: {
    id: "regional_director",
    label: "المدير الجهوي للأملاك الوطنية بالشلف",
    openingLine:
      "أنا الموقع أدناه المدير الجهوي للأملاك الوطنية بالشلف أصرح بأن:",
    signatureTitle: "المدير الجهوي",
  },
};

function formatAttachedBirthPlace(rawPlace) {
  const cleaned = String(rawPlace || "")
    .replace(/[()]/g, "")
    .trim();
  if (!cleaned || cleaned === "غير محدد") return "بـ ............";
  if (cleaned.startsWith("بـ")) {
    return `ب${cleaned.slice(2).trim()}`;
  }
  if (cleaned.startsWith("بال")) {
    return cleaned;
  }
  return `ب${cleaned}`;
}

function buildWorkDeclarationQrPayload({
  refNumber,
  year,
  issueDate,
  fullName,
  jobTitle,
  directorate,
  startDate,
  endDate,
}) {
  const yr = year || new Date().getFullYear();
  const ref = String(refNumber || "").trim() || "-";
  return [
    `إقرار بالعمل`,
    `المرجع: ${ref}/م.ج.أ.و.ش/${yr}`,
    `التاريخ: ${formatOfficialDateYMD(issueDate, "-")}`,
    `الموظف: ${String(fullName || "").trim() || "-"}`,
    `المنصب: ${String(jobTitle || "").trim() || "-"}`,
    `الهيئة: ${String(directorate || "").trim() || "-"}`,
    `الفترة: ${formatOfficialDateYMD(startDate, "-")} -> ${formatOfficialDateYMD(endDate, "-")}`,
  ].join("\n");
}

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
 * WorkDeclarationDocument — Official Printable A4 "إقرار بالعمل"
 * Replicates إقرار بالعمل.pdf structure with our official Regional Directorate header and top-left QR code.
 */
export default function WorkDeclarationDocument({
  employeeId,
  fullName = "",
  gender = "ذكر",
  birthDate = "",
  birthPlace = "",
  jobTitle = "",
  directorate = "",
  startDate = "",
  endDate = "",
  refNumber = "",
  year = new Date().getFullYear(),
  issueDate = "",
  signatoryKey = "sub_director",
}) {
  const valGender = String(gender || "").trim().toLowerCase();
  const isFemale =
    valGender === "أنثى" ||
    valGender === "انثى" ||
    valGender === "female" ||
    valGender === "f";

  const signatory =
    WORK_DECL_SIGNATORIES[signatoryKey] || WORK_DECL_SIGNATORIES.sub_director;

  const formattedBirthDate = formatOfficialDateYMD(birthDate, "..../../..");
  const formattedStartDate = formatOfficialDateYMD(startDate, "..../../..");
  const formattedEndDate = formatOfficialDateYMD(endDate, "..../../..");
  const formattedIssueDate = formatOfficialDateYMD(issueDate, "..../../..");
  const displayRefNum = String(refNumber || "").trim() || "............";
  const displayYear = year || new Date().getFullYear();

  const qrPayload = buildWorkDeclarationQrPayload({
    refNumber: String(refNumber || "").trim(),
    year: displayYear,
    issueDate,
    fullName,
    jobTitle,
    directorate,
    startDate,
    endDate,
  });

  const qrRefCode = generateOfficialRefCode(
    "WD",
    employeeId,
    refNumber,
    displayYear
  );

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
          fontSize: "20pt",
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
          marginBottom: "11mm",
        }}
      >
        {/* TOP LEFT: QR Code + Issue Date */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            minWidth: "165px",
          }}
        >
          <DocumentQrBadge
            payload={qrPayload}
            referenceCode={qrRefCode}
            size={84}
          />
          <div
            dir="rtl"
            style={{
              fontSize: "15pt",
              fontWeight: "bold",
              color: "#000000",
              marginTop: "2px",
              whiteSpace: "nowrap",
            }}
          >
            الشلف، في:{" "}
            {issueDate ? (
              <LtrDate value={formattedIssueDate} />
            ) : (
              "........................."
            )}
          </div>
        </div>

        {/* TOP RIGHT: Ministry & Directorate Hierarchy */}
        <div
          dir="rtl"
          style={{
            textAlign: "right",
            fontSize: "15pt",
            fontWeight: "bold",
            lineHeight: "1.45",
            color: "#000000",
          }}
        >
          <div>وزارة المالية</div>
          <div>المديرية العامة للأملاك الوطنية</div>
          <div>المديرية الجهوية للأملاك الوطنية بالشلف</div>
          <div>المديرية الفرعية للإدارة العامة</div>
          <div style={{ marginTop: "6px", fontSize: "15pt" }}>
            رقم:{" "}
            <span
              dir="ltr"
              style={{ display: "inline-block", unicodeBidi: "isolate" }}
            >
              {displayRefNum}
            </span>{" "}
            / م.ج.أ.و.ش /{" "}
            <span
              dir="ltr"
              style={{ display: "inline-block", unicodeBidi: "isolate" }}
            >
              {displayYear}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════ TITLE BLOCK (إقرار بالعمل) ══════════════ */}
      <div
        style={{
          textAlign: "center",
          margin: "8mm auto 10mm",
        }}
      >
        <span
          style={{
            fontSize: "28pt",
            fontWeight: "bold",
            color: "#000000",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          إقرار بالعمل
        </span>
      </div>

      {/* ══════════════ OPENING DECLARATION LINE ══════════════ */}
      <p
        style={{
          width: "100%",
          paddingRight: "8mm",
          fontSize: "18.5pt",
          fontWeight: "bold",
          lineHeight: "1.9",
          textAlign: "right",
          color: "#000000",
          margin: "0 0 12px 0",
        }}
      >
        {signatory.openingLine}
      </p>

      {/* ══════════════ EMPLOYEE & PERIOD BODY BLOCK ══════════════ */}
      <div
        style={{
          width: "100%",
          fontSize: "18pt",
          lineHeight: "2.15",
          color: "#000000",
        }}
      >
        {/* Bullet 1: Full Name */}
        <div
          style={{
            paddingRight: "10mm",
            textAlign: "right",
          }}
        >
          <span>- {isFemale ? "السيدة:" : "السيد:"} </span>
          <strong style={{ fontWeight: "bold", color: "#000000" }}>
            {String(fullName || "").trim() || "........................."}
          </strong>
        </div>

        {/* Bullet 2: Birth Date & Birth Place */}
        <div
          style={{
            paddingRight: "10mm",
            textAlign: "right",
            marginBottom: "8px",
          }}
        >
          <span>- {isFemale ? "المزدادة في:" : "المزداد في:"} </span>
          <LtrDate value={formattedBirthDate} bold />{" "}
          <span>{formatAttachedBirthPlace(birthPlace)} .</span>
        </div>

        {/* Main Period Paragraph */}
        <p
          style={{
            margin: 0,
            textAlign: "justify",
            textAlignLast: "right",
            lineHeight: "2.15",
            color: "#000000",
          }}
        >
          {isFemale ? "قد شغلت منصب " : "قد شغل منصب "}
          <strong style={{ fontWeight: "bold", color: "#000000" }}>
            {String(jobTitle || "").trim() || "........................."}
          </strong>{" "}
          على مستوى{" "}
          <strong style={{ fontWeight: "bold", color: "#000000" }}>
            {String(directorate || "").trim() ||
              "المديرية الجهوية للأملاك الوطنية بالشلف"}
          </strong>{" "}
          من تاريخ <LtrDate value={formattedStartDate} bold /> إلى غاية{" "}
          <LtrDate value={formattedEndDate} bold />.
        </p>

        {/* Closing Attestation Sentence */}
        <p
          style={{
            marginTop: "24px",
            marginBottom: 0,
            textIndent: "12mm",
            textAlign: "justify",
            textAlignLast: "right",
            lineHeight: "2.0",
            color: "#000000",
          }}
        >
          {isFemale
            ? "و إثباتاً لذلك، سلمت هذه الشهادة بناءً على طلبها لتدلي بها عند الاقتضاء في حدود ما هو مقرر قانونياً."
            : "و إثباتاً لذلك، سلمت هذه الشهادة بناءً على طلبه ليدلي بها عند الاقتضاء في حدود ما هو مقرر قانونياً."}
        </p>
      </div>

      {/* ══════════════ SIGNATURE BLOCK (LEFT SIDE) ══════════════ */}
      <div
        style={{
          marginTop: "38px",
          paddingRight: "54%",
          textAlign: "center",
          color: "#000000",
        }}
      >
        <div
          style={{
            fontSize: "18pt",
            fontWeight: "bold",
            marginBottom: "14px",
            whiteSpace: "nowrap",
          }}
        >
          حرر بالشلف، في:{" "}
          {issueDate ? (
            <LtrDate value={formattedIssueDate} />
          ) : (
            "........................"
          )}
        </div>
        <div
          style={{
            fontSize: "19pt",
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
          fontSize: "13.5pt",
          lineHeight: "1.6",
          color: "#000000",
        }}
      >
        <div
          style={{
            borderTop: "1px solid #000000",
            width: "105px",
            paddingTop: "4px",
            fontWeight: "bold",
            marginBottom: "2px",
          }}
        >
          نسخة إلى:
        </div>
        <div>- المعني(ة).</div>
        <div>- ملف الأرشفة.</div>
      </div>
    </div>
  );
}
