import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import EmployeeService from "../../services/employeeService";
import {
  formatProvincialDirectorate,
  REGIONAL_DIRECTORATE,
  PROVINCIAL_AMLAK_BASE,
  PROVINCIAL_MASH_BASE,
} from "../../utils/constants";

/**
 * Formats a date into DD/MM/YYYY without timezone shift.
 * Ignores sentinel SQL dates (year <= 1900).
 */
export function formatOfficialDate(dateInput, fallback = "..../..../......") {
  if (!dateInput) return fallback;
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return fallback;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
    const iso = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (iso) {
      const year = parseInt(iso[1], 10);
      if (year <= 1900) return fallback;
      return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return fallback;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

/**
 * Converts date input to YYYY-MM-DD for HTML date inputs.
 */
export function toIsoDateInput(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return parseInt(iso[1], 10) <= 1900 ? "" : `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTodayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Gendered Arabic administrative phrasing based on employee.Gender.
 */
export function getOfficialGenderPhrasing(rawGender) {
  const val = String(rawGender || "").trim().toLowerCase();
  const isFemale = val === "أنثى" || val === "انثى" || val === "female" || val === "f";
  if (isFemale) {
    return {
      isFemale: true,
      title: "السيدة",
      born: "المولودة",
      practices: "تمارس مهامها",
      asRole: "بصفتها",
      present: "وهي متواجدة",
      toHimHer: "لها",
      hisHerRequest: "طلبها",
      concerned: "المعنية",
      concernedWithBi: "بالمعنية",
      benefits: "تستفيد",
    };
  }
  return {
    isFemale: false,
    title: "السيد",
    born: "المولود",
    practices: "يمارس مهامه",
    asRole: "بصفته",
    present: "وهو متواجد",
    toHimHer: "له",
    hisHerRequest: "طلبه",
    concerned: "المعني",
    concernedWithBi: "بالمعني",
    benefits: "يستفيد",
  };
}

/**
 * Formats numbers using Arabic/French decimal comma (e.g. 45.63 -> "45,63", 1.4 -> "1,4").
 */
export function formatCommaDecimal(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const fixed = decimals != null ? num.toFixed(decimals) : String(num);
  // Trim trailing zero only if decimals is null; otherwise keep exact administrative precision
  return fixed.replace(".", ",");
}

/**
 * Computes experience allowance percentage and formatted formula string.
 * Example: (31 سنة × 1,4%) + 2,23% = 45,63%
 * Omits `+ extra%` cleanly when extraPercent is 0.
 */
export function computeExperienceAllowance(yearsInput, extraPercentInput = 0, rate = 1.4) {
  const years = Math.max(0, Number(yearsInput) || 0);
  const extra = Math.max(0, Number(extraPercentInput) || 0);
  const baseTotal = years * rate;
  const total = Math.round((baseTotal + extra) * 100) / 100;

  const rateStr = formatCommaDecimal(rate, 1);
  const totalStr = formatCommaDecimal(total, 2);
  const hasExtra = extra > 0;
  const extraStr = formatCommaDecimal(extra, 2);

  const formulaParts = {
    years,
    rateStr,
    hasExtra,
    extraStr,
    total,
    totalStr,
  };

  const formulaText = hasExtra
    ? `(${years} سنة × ${rateStr}%) + ${extraStr}% = ${totalStr}%`
    : `(${years} سنة × ${rateStr}%) = ${totalStr}%`;

  return { ...formulaParts, formulaText };
}

/**
 * Auto-suggests full years of service from FirstHireDate / InstallationDate to today.
 */
export function suggestExperienceYears(hireDate) {
  const iso = toIsoDateInput(hireDate);
  if (!iso) return 0;
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  let years = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d)) {
    years -= 1;
  }
  return Math.max(0, years);
}

export function resolveEmployeeFullName(employee) {
  if (!employee) return "";
  const last = String(employee.LastName || employee.lastName || "").trim();
  const first = String(employee.Name || employee.name || "").trim();
  return [last, first].filter(Boolean).join(" ").trim();
}

export function resolveEmployeeJobTitle(employee) {
  if (!employee) return "";
  return (
    employee.JobTitle?.RankName ||
    employee.RankName ||
    employee.RankHistories?.[0]?.RankName ||
    ""
  ).trim();
}

export function resolveEmployeeDirectorate(employee) {
  if (!employee) return "المديرية الجهوية للأملاك الوطنية بالشلف";
  const dir = String(employee.Directorate || "").trim();
  const prov = String(employee.Province || "").trim();

  if (!dir || dir === REGIONAL_DIRECTORATE || dir === "المديرية الجهوية للاملاك الوطنية") {
    return "المديرية الجهوية للأملاك الوطنية بالشلف";
  }

  const normalized = formatProvincialDirectorate(dir, prov);
  if (normalized.startsWith(PROVINCIAL_AMLAK_BASE) && prov) {
    return `مديرية أملاك الدولة لولاية ${prov}`;
  }
  if (normalized.startsWith(PROVINCIAL_MASH_BASE) && prov) {
    return `مديرية مسح الأراضي والحفظ العقاري لولاية ${prov}`;
  }
  return normalized || dir;
}

/**
 * Auto-resolves target provincial director title for Article 02 of the Experience Decision.
 */
export function resolveTargetDirectorTitle(directorate, province) {
  const dir = String(directorate || "").trim();
  const prov = String(province || "").trim() || "الشلف";

  if (
    dir.includes("مسح الأراضي") ||
    dir.includes("الحفظ العقاري") ||
    dir.includes("المحافظة العقارية")
  ) {
    return `مدير مسح الأراضي والحفظ العقاري لولاية ${prov}`;
  }
  if (dir.includes("أملاك الدولة") || dir.includes("مفتشية")) {
    return `مدير أملاك الدولة لولاية ${prov}`;
  }
  return `مدير أملاك الدولة لولاية ${prov}`;
}

/**
 * Generates compact reference code shown under top-left QR code.
 */
export function generateOfficialRefCode(prefix, employeeId, refNumber, year) {
  const numPart = String(refNumber || "000").trim() || "000";
  const yr = year || new Date().getFullYear();
  const idPart = employeeId ? `EMP${employeeId}` : "EMP0";
  return `${prefix}-${yr}-${numPart}-${idPart}`;
}

export function buildWorkCertificateQrPayload({
  refNumber,
  year,
  issueDate,
  employeeId,
  fullName,
  jobTitle,
  directorate,
  firstHireDate,
}) {
  return [
    `Document: شهادة عمل`,
    `Ref: ${refNumber || "N/A"}/م.ج.أ.و.ش/${year || new Date().getFullYear()}`,
    `Issue Date: ${formatOfficialDate(issueDate, "N/A")}`,
    `Employee ID: ${employeeId || "N/A"}`,
    `Name: ${fullName || "N/A"}`,
    `Job Title: ${jobTitle || "N/A"}`,
    `Directorate: ${directorate || "N/A"}`,
    `Hire Date: ${formatOfficialDate(firstHireDate, "N/A")}`,
  ].join("\n");
}

export function buildExperienceDecisionQrPayload({
  refNumber,
  year,
  employeeId,
  fullName,
  jobTitle,
  years,
  totalPercentStr,
  effectiveDate,
}) {
  return [
    `Document: مقرر تعويض الخبرة المهنية`,
    `Ref: ${refNumber || "N/A"}/م.ج.أ.و.ش/${year || new Date().getFullYear()}`,
    `Employee ID: ${employeeId || "N/A"}`,
    `Name: ${fullName || "N/A"}`,
    `Job Title: ${jobTitle || "N/A"}`,
    `Years: ${years ?? 0}`,
    `Total Percentage: ${totalPercentStr || "0,00"}%`,
    `Effective Date: ${formatOfficialDate(effectiveDate, "N/A")}`,
  ].join("\n");
}

/**
 * Hook: ensures full employee summary fields (DateOfBirth, PlaceOfBirth, InstallationDate, JobTitle)
 * are loaded even when a modal is launched from EmployeesList rows.
 */
export function useResolvedEmployee(isOpen, employee) {
  const [resolved, setResolved] = useState(employee);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setResolved(employee);
    if (!isOpen || !employee) return;

    const empId = employee.Id || employee.id;
    const needsFetch =
      empId &&
      (!employee.JobTitle ||
        employee.DateOfBirth === undefined ||
        employee.InstallationDate === undefined);

    if (!needsFetch) return;

    let cancelled = false;
    setLoading(true);
    EmployeeService.getSummary(empId)
      .then((res) => {
        if (!cancelled && res?.success && res.data) {
          setResolved((prev) => ({ ...prev, ...res.data }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, employee]);

  return { resolvedEmployee: resolved || employee, isLoadingEmployee: loading };
}

/**
 * Isolated A4 Print Engine via hidden iframe.
 * Prints ONLY the rendered document component with zero sidebar/navbar bleed.
 */
export function printOfficialDocumentInIframe(Component, props, docTitle = "وثيقة رسمية") {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${docTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      direction: rtl;
      background: white;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .official-a4-sheet {
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
      }
    }
  </style>
</head>
<body>
  <div id="official-print-root"></div>
</body>
</html>`);
    iframeDoc.close();

    const mountPoint = iframeDoc.getElementById("official-print-root");
    const root = createRoot(mountPoint);
    root.render(React.createElement(Component, props));

    const attemptPrint = () => {
      const sheet = iframeDoc.querySelector(".official-a4-sheet");
      if (!sheet) {
        setTimeout(attemptPrint, 100);
        return;
      }

      const printNow = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error("Official document print failed:", err);
        }

        const cleanup = () => {
          try {
            root.unmount();
          } catch (_) {}
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve();
        };

        try {
          iframe.contentWindow.addEventListener("afterprint", cleanup, { once: true });
        } catch (_) {}
        setTimeout(cleanup, 60000);
      };

      if (iframeDoc.fonts && iframeDoc.fonts.ready) {
        iframeDoc.fonts.ready.then(() => setTimeout(printNow, 200));
      } else {
        setTimeout(printNow, 700);
      }
    };

    setTimeout(attemptPrint, 250);
  });
}
