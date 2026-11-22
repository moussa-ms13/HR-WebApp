import React, { useState, useRef, useLayoutEffect } from "react";
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

// Arabic dual-joining letters that can connect to a following Arabic letter via Kashida (ـ)
const DUAL_JOIN_CHARS = new Set("بتثجحخسشصضطظعغفقكلمنهيئ".split(""));
const RIGHT_JOIN_REGEX = /[\u0622-\u064A]/;
const ALEF_VARIANTS = new Set(["\u0622", "\u0623", "\u0625", "\u0627"]);

function getKashidaSlots(chars) {
  const slots = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const curr = chars[i];
    const next = chars[i + 1];
    if (!DUAL_JOIN_CHARS.has(curr) || !RIGHT_JOIN_REGEX.test(next)) {
      continue;
    }
    if (curr === "ل" && (ALEF_VARIANTS.has(next) || next === "ل")) {
      continue;
    }
    slots.push(i);
  }
  return slots;
}

function applyKashidaCount(baseText, totalTatweels) {
  if (!baseText || totalTatweels <= 0) return baseText;
  const chars = Array.from(baseText);
  const slots = getKashidaSlots(chars);
  if (slots.length === 0) return baseText;

  const counts = new Array(chars.length).fill(0);
  const basePerSlot = Math.floor(totalTatweels / slots.length);
  const remainder = totalTatweels % slots.length;

  for (let s = 0; s < slots.length; s++) {
    const extra = s < remainder ? 1 : 0;
    counts[slots[s]] = basePerSlot + extra;
  }

  let out = "";
  for (let i = 0; i < chars.length; i++) {
    out += chars[i];
    if (counts[i] > 0) {
      out += "\u0640".repeat(counts[i]);
    }
  }
  return out;
}

/**
 * Formats birthplace directly attached to preposition "ب" without parentheses or tatweel
 * (e.g. "الشلف" -> "بالشلف", "العطاف" -> "بالعطاف").
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
 * WorkCertificateDocument — Official Printable A4 "شهادة عمل"
 * Calibrated with large official typography, full-width kashida opening line, and top-left QR code.
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

  const baseOpeningLine = signatory.openingLine.replace(/\u0640/g, "");
  const openingContainerRef = useRef(null);
  const openingSpanRef = useRef(null);
  const [stretchedOpeningLine, setStretchedOpeningLine] = useState(() =>
    applyKashidaCount(baseOpeningLine, 44)
  );

  useLayoutEffect(() => {
    const container = openingContainerRef.current;
    const span = openingSpanRef.current;
    if (!container || !span) return;

    let isCancelled = false;

    const calibrateKashida = () => {
      if (isCancelled || !openingContainerRef.current || !openingSpanRef.current) {
        return;
      }
      const pEl = openingContainerRef.current;
      const sEl = openingSpanRef.current;
      const computed = (pEl.ownerDocument?.defaultView || window).getComputedStyle(pEl);
      const padRight = parseFloat(computed.paddingRight) || 0;
      const padLeft = parseFloat(computed.paddingLeft) || 0;
      const availableWidth = pEl.clientWidth - padRight - padLeft;
      if (!availableWidth || availableWidth <= 0) return;

      const targetWidth = availableWidth * 0.985;

      sEl.textContent = baseOpeningLine;
      const baseWidth = sEl.offsetWidth;
      if (baseWidth >= targetWidth) {
        setStretchedOpeningLine(baseOpeningLine);
        return;
      }

      const probeCount = 22;
      sEl.textContent = applyKashidaCount(baseOpeningLine, probeCount);
      const probeWidth = sEl.offsetWidth;
      const pxPerTatweel = (probeWidth - baseWidth) / probeCount;

      if (pxPerTatweel <= 0.05) {
        setStretchedOpeningLine(baseOpeningLine);
        return;
      }

      let bestCount = Math.max(
        0,
        Math.floor((targetWidth - baseWidth) / pxPerTatweel)
      );

      sEl.textContent = applyKashidaCount(baseOpeningLine, bestCount);
      let currWidth = sEl.offsetWidth;

      let guard = 0;
      while (currWidth < targetWidth && guard < 80) {
        const nextText = applyKashidaCount(baseOpeningLine, bestCount + 1);
        sEl.textContent = nextText;
        const nextWidth = sEl.offsetWidth;
        if (nextWidth > availableWidth - 2) {
          break;
        }
        bestCount += 1;
        currWidth = nextWidth;
        guard += 1;
      }

      while (currWidth > availableWidth - 2 && bestCount > 0 && guard < 160) {
        bestCount -= 1;
        sEl.textContent = applyKashidaCount(baseOpeningLine, bestCount);
        currWidth = sEl.offsetWidth;
        guard += 1;
      }

      const finalString = applyKashidaCount(baseOpeningLine, bestCount);
      sEl.textContent = finalString;
      setStretchedOpeningLine(finalString);
    };

    calibrateKashida();

    const ownerDoc = container.ownerDocument || document;
    if (ownerDoc.fonts && ownerDoc.fonts.ready) {
      ownerDoc.fonts.ready.then(() => {
        if (!isCancelled) calibrateKashida();
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [baseOpeningLine]);

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
          <DocumentQrBadge payload={qrPayload} referenceCode={qrRefCode} size={84} />
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
            {issueDate ? <LtrDate value={formattedIssueDate} /> : "........................."}
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

      {/* ══════════════ TITLE BOX (شـهـــــــــــــادة عـــمـــــــــــــل) ══════════════ */}
      <div style={{ textAlign: "center", marginBottom: "13mm" }}>
        <div
          style={{
            width: "58%",
            margin: "0 auto",
            padding: "6px 20px",
            border: "1.5px solid #000000",
            borderRadius: "10px",
            backgroundColor: "#e2e5ea",
            boxShadow: "2px 3px 0px rgba(0,0,0,0.22)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "25pt",
              fontWeight: "bold",
              color: "#000000",
              textDecoration: "none",
              wordSpacing: "16px",
              whiteSpace: "nowrap",
            }}
          >
            شـهـــــــــــــادة عـــمـــــــــــــل
          </span>
        </div>
      </div>

      {/* ══════════════ OPENING AUTHORITY LINE ══════════════ */}
      <p
        ref={openingContainerRef}
        style={{
          width: "100%",
          paddingRight: "10mm",
          fontSize: "19pt",
          fontWeight: "bold",
          lineHeight: "1.8",
          textAlign: "right",
          whiteSpace: "nowrap",
          wordSpacing: "normal",
          color: "#000000",
          margin: 0,
          overflow: "hidden",
        }}
      >
        <span
          ref={openingSpanRef}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            color: "#000000",
          }}
        >
          {stretchedOpeningLine}
        </span>
      </p>

      {/* ══════════════ MAIN BODY PARAGRAPH ══════════════ */}
      <p
        style={{
          width: "100%",
          marginTop: "14px",
          marginBottom: 0,
          fontSize: "18.5pt",
          lineHeight: "2.1",
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
          marginTop: "24px",
          marginBottom: 0,
          paddingRight: "16mm",
          fontSize: "17.5pt",
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
          marginTop: "30px",
          paddingRight: "58%",
          textAlign: "center",
        }}
      >
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
