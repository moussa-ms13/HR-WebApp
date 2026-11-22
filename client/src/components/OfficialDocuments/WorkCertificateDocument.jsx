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

/**
 * Finds all valid Arabic dual-joining indices in `chars` where a tatweel (\u0640)
 * can be inserted without breaking Lam-Alef (لا / لأ / لإ / لآ) ligatures.
 */
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

/**
 * Distributes `totalTatweels` (\u0640) evenly round-robin across all valid
 * Arabic connection points in `baseText`.
 */
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
 * (e.g. "الشلف - الشلف" -> "بالشلف - الشلف", "تيارت" -> "بتيارت").
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
 * font family, font size, and font weight of the surrounding Arabic text.
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

  const baseOpeningLine = signatory.openingLine.replace(/\u0640/g, "");
  const openingContainerRef = useRef(null);
  const openingSpanRef = useRef(null);
  const [stretchedOpeningLine, setStretchedOpeningLine] = useState(() =>
    applyKashidaCount(baseOpeningLine, 88)
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
      const maxWidth = pEl.clientWidth;
      if (!maxWidth || maxWidth <= 0) return;

      const targetWidth = maxWidth * 0.992;

      sEl.textContent = baseOpeningLine;
      const baseWidth = sEl.offsetWidth;
      if (baseWidth >= targetWidth) {
        setStretchedOpeningLine(baseOpeningLine);
        return;
      }

      const probeCount = 25;
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
        if (nextWidth > maxWidth - 1) {
          break;
        }
        bestCount += 1;
        currWidth = nextWidth;
        guard += 1;
      }

      while (currWidth > maxWidth - 1 && bestCount > 0 && guard < 160) {
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
        padding: "15mm 15mm 18mm 15mm",
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
            marginBottom: "9mm",
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
            marginBottom: "15mm",
          }}
        >
          {/* TOP LEFT: QR Code + Issue Date */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              minWidth: "155px",
            }}
          >
            <DocumentQrBadge payload={qrPayload} referenceCode={qrRefCode} size={84} />
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
              lineHeight: "1.6",
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

        {/* CENTER TITLE: Framed Bold & Underlined (Horizontally Stretched Without Increasing Font Size) */}
        <div style={{ textAlign: "center", marginBottom: "16mm" }}>
          <div
            style={{
              display: "inline-block",
              padding: "7px 68px 11px 68px",
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
                wordSpacing: "10px",
                color: "#000000",
              }}
            >
              شـهـــــادة عـمـــــل
            </span>
          </div>
        </div>

        {/* OPENING SIGNATORY: Dynamic Full-Width Arabic Kashida Stretch With Normal Word Spacing */}
        <p
          ref={openingContainerRef}
          style={{
            width: "100%",
            fontSize: "14.5pt",
            fontWeight: "bold",
            lineHeight: "2",
            marginBottom: "6mm",
            textAlign: "right",
            wordSpacing: "normal",
            whiteSpace: "nowrap",
            textIndent: "0",
            overflow: "hidden",
            color: "#000000",
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

        {/* MAIN BODY */}
        <p
          style={{
            width: "100%",
            fontSize: "14.5pt",
            lineHeight: "2.3",
            textAlign: "justify",
            marginBottom: "12mm",
            color: "#000000",
          }}
        >
          بأن {g.title}{" "}
          <strong style={{ color: "#000000" }}>
            {fullName || "........................."}
          </strong>{" "}
          {g.born} بتاريخ <LtrDate value={formattedBirthDate} />{" "}
          <strong style={{ color: "#000000" }}>
            {formatAttachedBirthPlace(birthPlace)}
          </strong>
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
            fontSize: "14.5pt",
            lineHeight: "2.1",
            textAlign: "right",
            textIndent: "10mm",
            marginBottom: "18mm",
            color: "#000000",
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
            <div style={{ fontSize: "14.5pt", fontWeight: "bold", color: "#000000" }}>
              {signatory.signatureTitle}
            </div>
            <div style={{ height: "16mm" }} />
          </div>
        </div>
      </div>

      {/* ══════════════ BOTTOM RIGHT COPIES FOOTER (Raised Upward) ══════════════ */}
      <div
        style={{
          textAlign: "right",
          fontSize: "12pt",
          lineHeight: "1.7",
          color: "#000000",
          paddingTop: "4mm",
          marginBottom: "22mm",
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
