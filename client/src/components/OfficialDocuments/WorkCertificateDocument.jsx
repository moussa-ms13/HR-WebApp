import React from "react";
import DocumentQrBadge from "./DocumentQrBadge";
import {
  formatOfficialDate,
  getOfficialGenderPhrasing,
  buildWorkCertificateQrPayload,
  generateOfficialRefCode,
} from "./officialDocumentUtils";

export const WORK_CERT_SIGNATORIES = {
  sub_director: {
    id: "sub_director",
    label: "المدير الفرعي للإدارة العامة (الافتراضي)",
    openingLine: "نحن المدير الفرعي للإدارة العامة للأملاك الوطنية بالشلف، نشهد",
    signatureTitle: "المدير الفرعي للإدارة العامة",
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

  const formattedBirthDate = formatOfficialDate(birthDate, "..../..../......");
  const formattedHireDate = formatOfficialDate(firstHireDate, "..../..../......");
  const formattedIssueDate = formatOfficialDate(issueDate, "..../..../......");
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
        padding: "14mm 18mm 16mm 18mm",
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
            fontSize: "14.5pt",
            fontWeight: "bold",
            marginBottom: "8mm",
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
            marginBottom: "14mm",
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
              lineHeight: "1.55",
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
        <div style={{ textAlign: "center", marginBottom: "16mm" }}>
          <div
            style={{
              display: "inline-block",
              padding: "6px 44px 10px 44px",
              border: "1.5px solid #1f2937",
              borderRadius: "8px",
              backgroundColor: "#f3f4f6",
              boxShadow: "3px 3px 0px #9ca3af",
            }}
          >
            <span
              style={{
                fontSize: "21pt",
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
            fontSize: "14.5pt",
            fontWeight: "bold",
            lineHeight: "2",
            marginBottom: "8mm",
            textAlign: "right",
            textIndent: "12mm",
          }}
        >
          {signatory.openingLine}
        </p>

        {/* MAIN BODY */}
        <p
          style={{
            fontSize: "14.5pt",
            lineHeight: "2.15",
            textAlign: "justify",
            marginBottom: "10mm",
            color: "#111827",
          }}
        >
          بأن {g.title}{" "}
          <strong style={{ fontSize: "15.5pt", color: "#000000" }}>
            {fullName || "........................."}
          </strong>{" "}
          {g.born} بتاريخ <LtrDate value={formattedBirthDate} /> بـ (
          <strong>{birthPlace || "..............."}</strong>)، {g.practices} {g.asRole}{" "}
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
            fontSize: "14.5pt",
            lineHeight: "2",
            textAlign: "right",
            textIndent: "12mm",
            marginBottom: "18mm",
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
            paddingLeft: "10mm",
          }}
        >
          <div style={{ width: "260px", textAlign: "center" }}>
            <div style={{ fontSize: "14.5pt", fontWeight: "bold", color: "#000000" }}>
              {signatory.signatureTitle}
            </div>
            <div style={{ height: "24mm" }} />
          </div>
        </div>
      </div>

      {/* ══════════════ BOTTOM RIGHT COPIES FOOTER ══════════════ */}
      <div
        style={{
          textAlign: "right",
          fontSize: "11.5pt",
          lineHeight: "1.65",
          color: "#1f2937",
          paddingTop: "6mm",
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
