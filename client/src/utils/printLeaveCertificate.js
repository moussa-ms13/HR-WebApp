import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  normalizeCorpsType,
  normalizeGender,
  getGenderProfile,
  numberToArabicWords,
  formatAdminDate as configFormatAdminDate,
  formatAlgerianAdministrativeDate,
  generateReferenceCode,
  buildQrPayload,
  SICK_LEAVE_SOCIAL_SECURITY_LAW,
  CIVIL_SERVICE_ORDINANCE,
  CONTRACTUAL_STAFF_DECREE,
  SICK_LEAVE_PROPOSAL,
} from './leaveCertificateConfig.js';
import { addOneDay } from './dateUtils.js';

/**
 * Algerian administrative date formatting helper: strict YYYY/MM/DD.
 * Handles strings (YYYY-MM-DD, DD/MM/YYYY) and Date objects without timezone shift.
 */
export const formatAdminDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    const trimmed = date.trim();
    const ymd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymd) {
      return `${ymd[1]}/${ymd[2].padStart(2, '0')}/${ymd[3].padStart(2, '0')}`;
    }
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      return `${dmy[3]}/${dmy[2].padStart(2, '0')}/${dmy[1].padStart(2, '0')}`;
    }
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

/**
 * Builds normalized print data payload for LeavePrintDocument
 * from an employee state record and an optional employee object fallback.
 */
export function buildPrintDataFromState(st, fallbackEmployee = null) {
  const stClean = st || {};
  const nestedLeave = stClean.leave || stClean.Leave || {};
  const emp = stClean.Employee || fallbackEmployee || {};
  const warnings = [];

  // Leave type
  const leaveType = stClean.StateTypeOrReason || stClean.stateTypeOrReason || "عطلة سنوية";
  const isSickLeave = leaveType === "عطلة مرضية";
  const isMaternityLeave = leaveType === "عطلة أمومة";
  const isDecisionDoc = isSickLeave || isMaternityLeave;

  // First doctor & cert date (all casing variants)
  const doctorName =
    stClean.DoctorName ||
    stClean.doctorName ||
    stClean.doctor ||
    stClean.Doctor ||
    nestedLeave.doctorName ||
    nestedLeave.DoctorName ||
    "";
  const certDateRaw =
    stClean.CertificateDate ||
    stClean.certificateDate ||
    stClean.certDate ||
    stClean.CertDate ||
    nestedLeave.certificateDate ||
    nestedLeave.CertificateDate ||
    "";
  const certificateDate = formatAdminDate(certDateRaw);

  // Second doctor & second cert date (all casing variants)
  const secondDoctorName =
    stClean.SecondDoctorName ||
    stClean.secondDoctorName ||
    stClean.doctorName2 ||
    stClean.DoctorName2 ||
    stClean.secondDoctor ||
    stClean.SecondDoctor ||
    stClean.doctor_name_2 ||
    nestedLeave.secondDoctorName ||
    nestedLeave.SecondDoctorName ||
    "";
  const secondCertDateRaw =
    stClean.SecondCertificateDate ||
    stClean.secondCertificateDate ||
    stClean.certificateDate2 ||
    stClean.CertificateDate2 ||
    stClean.secondCertDate ||
    stClean.SecondCertDate ||
    stClean.certificate_date_2 ||
    nestedLeave.secondCertificateDate ||
    nestedLeave.SecondCertificateDate ||
    "";
  const secondCertificateDate = secondCertDateRaw ? formatAdminDate(secondCertDateRaw) : "";

  const hasSecondCertificate = Boolean(
    stClean.HasSecondCertificate ??
    stClean.hasSecondCertificate ??
    nestedLeave.hasSecondCertificate ??
    (secondDoctorName || secondCertificateDate)
  );

  // Normalize corps type
  const empWithJob = {
    ...emp,
    CurrentJobTitle: emp.CurrentJobTitle || stClean.CurrentJobTitle,
  };
  const corpsType = normalizeCorpsType(empWithJob);
  if (!isDecisionDoc && corpsType === "unknown") {
    warnings.push("لم يتم تحديد نوع السلك (مشترك/خاص/تعاقدي). تم استخدام الأسلاك المشتركة كقيمة افتراضية.");
  }

  // Normalize gender
  const gender = isMaternityLeave ? "female" : normalizeGender(emp.Gender);
  if (!gender && !isMaternityLeave) {
    warnings.push("جنس الموظف غير محدد أو غير صالح. تم استخدام صيغة المذكر كقيمة افتراضية. يرجى تصحيح بيانات الموظف.");
  }
  const genderProfile = getGenderProfile(gender || "male");

  // Employee name: Strictly "LastName FirstName" (اللقب ثم الاسم) for all printed documents & decisions
  const lastName = (emp.LastName || emp.lastName || "").trim();
  const firstName = (emp.Name || emp.firstName || "").trim();
  const fullName = (lastName && firstName && lastName !== firstName)
    ? `${lastName} ${firstName}`
    : (emp.name || emp.fullName || [lastName, firstName].filter(Boolean).join(" ").trim());

  // Rank (from JobTitle relation)
  const rank = emp.JobTitle?.RankName || stClean.CurrentJobTitle || "";

  // Leave year — derive from StartDate
  const startYear = stClean.StartDate ? new Date(stClean.StartDate).getFullYear() : new Date().getFullYear();
  const leaveYear = String(startYear);

  // Days in words
  const days = stClean.DaysCount || 0;
  const daysInWords = numberToArabicWords(days);

  // Dates (strictly formatted as YYYY/MM/DD without timezone shift)
  const startDate = formatAdminDate(stClean.StartDate);
  const endDate = formatAdminDate(stClean.EndDate);
  const rawResumeDate = (!isDecisionDoc && stClean.EndDate)
    ? addOneDay(stClean.EndDate)
    : (stClean.ResumptionDate || stClean.ActualReturnDate || stClean.EndDate);
  const resumeDate = formatAdminDate(rawResumeDate);
  const dateOfBirth = formatAdminDate(emp.DateOfBirth);

  // Reference code
  const refCode = generateReferenceCode(emp.Name, emp.LastName, emp.DateOfBirth, stClean.StartDate);

  // QR payload (offline informational)
  const qrPayload = buildQrPayload({
    referenceCode: refCode,
    employeeName: fullName,
    dateOfBirth,
    startDate,
    endDate,
    resumeDate,
    rank,
    jobTitle: emp.AssignedPosition || "/",
    province: emp.Province || "الشلف",
    leaveYear,
    leaveType,
    doctorName,
    certificateDate,
    hasSecondCertificate,
    secondDoctorName,
    secondCertificateDate,
  });

  // Remaining balance (strictly omitted for decision documents like sick and maternity leave)
  const remaining = isDecisionDoc
    ? []
    : (Array.isArray(stClean._remainingBreakdown) && stClean._remainingBreakdown.length > 0)
      ? stClean._remainingBreakdown.map((r) => ({
          year: String(r.year),
          days: r.days,
          daysInWords: numberToArabicWords(r.days),
        }))
      : stClean.RemainingBalanceAfter != null
        ? [{
            year: leaveYear,
            days: stClean.RemainingBalanceAfter,
            daysInWords: numberToArabicWords(stClean.RemainingBalanceAfter),
          }]
        : [];

  // Signature date = today in Algerian administrative format (e.g., 05 أكتوبر 2026)
  const today = new Date();
  const sigDate = formatAlgerianAdministrativeDate(today);

  return {
    leaveType,
    corpsType: corpsType === "unknown" ? "common" : corpsType,
    genderProfile,
    header: {
      wilaya: emp.Province || "الشلف",
      subDirectorate: "الإدارة العامة",
      referenceNumber: "",
    },
    employee: {
      name: fullName,
      LastName: lastName,
      Name: firstName,
      lastName,
      firstName,
      gender: gender || "male",
      dateOfBirth,
      rank,
      jobTitle: emp.AssignedPosition || "",
      province: emp.Province || "الشلف",
    },
    decision: {
      directorateName: "المديرية الجهوية للأملاك الوطنية بالشلف",
    },
    leave: {
      type: leaveType,
      StateTypeOrReason: leaveType,
      year: leaveYear,
      days,
      daysInWords,
      startDate,
      endDate,
      resumeDate,
      remaining,
      doctorName,
      certificateDate,
      hasSecondCertificate,
      secondDoctorName,
      secondCertificateDate,
      notes: stClean.Notes || stClean.notes,
    },
    hasSecondCertificate,
    doctorName,
    certificateDate,
    secondDoctorName,
    secondCertificateDate,
    signature: {
      place: emp.Province || "الشلف",
      date: sigDate,
      title: "المدير الفرعي",
    },
    qrPayload,
    referenceCode: refCode,
    warnings,
  };
}

/**
 * Generates standalone, print-ready HTML for the Sick Leave Decision ("مقرر عطلة مرضية").
 * Features rich Algerian administrative typography, Amiri font, and calibrated single A4 page layout.
 *
 * @param {Object} stateRecord - State record object or printData
 * @param {Object} [fallbackEmployee] - Optional employee object fallback
 * @returns {string} Fully self-contained HTML document string
 */
export function generateSickLeaveHTML(stateRecord, fallbackEmployee = null) {
  const data = stateRecord?.employee && stateRecord?.leave
    ? stateRecord
    : buildPrintDataFromState(stateRecord, fallbackEmployee);

  const emp = data.employee || {};
  const empLastName = (emp.LastName || emp.lastName || data.LastName || data.lastName || "").trim();
  const empFirstName = (emp.Name || emp.firstName || data.Name || data.firstName || "").trim();
  const empFullName = (empLastName && empFirstName && empLastName !== empFirstName)
    ? `${empLastName} ${empFirstName}`
    : (emp.name || emp.fullName || [empLastName, empFirstName].filter(Boolean).join(" ").trim());
  const lv = data.leave || {};
  const g = data.genderProfile || getGenderProfile(emp.gender || "male");
  const isContractual = data.corpsType === "contractual";

  const firstDoctorText = lv.doctorName
    ? `<strong>${lv.doctorName}</strong>`
    : `<strong>الطبيب المعالج</strong>`;

  const secondDoctorText = lv.secondDoctorName
    ? `<strong>${lv.secondDoctorName}</strong>`
    : (lv.doctorName
        ? `<strong>${lv.doctorName}</strong>`
        : `<strong>الطبيب المعالج</strong>`);

  const secondCertHtml = (lv.hasSecondCertificate || lv.secondDoctorName || lv.secondCertificateDate) && (lv.secondCertificateDate || lv.secondDoctorName)
    ? `<p class="doc-whereas">- وبناء على الشهادة الطبية الصادرة عن ${secondDoctorText} والمؤرخة في <span dir="ltr" class="admin-date">${lv.secondCertificateDate || "............."}</span>،</p>`
    : "";

  const notesHtml = lv.notes
    ? `<div class="doc-remark"><span class="doc-remark-label">الملاحظات :</span> ${lv.notes}</div>`
    : "";

  const isMaternity = data.leaveType === "عطلة أمومة";
  const docTitle = isMaternity ? "مقرر عطلة أمومة" : "مقرر عطلة مرضية";
  const leaveName = isMaternity ? "عطلة أمومة" : "عطلة مرضية";

  return `<!DOCTYPE html>
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
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
      color: #111827;
    }
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
        box-shadow: none !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    .leave-doc-page {
      width: 100%;
      max-width: 210mm;
      max-height: 297mm;
      margin: 0 auto;
      padding: 10mm 15mm 14mm 15mm;
      box-sizing: border-box;
      direction: rtl;
      overflow: hidden;
      font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
    }
    .doc-header { width: 100%; margin-bottom: 6px; }
    .doc-header-top { text-align: center; margin-bottom: 6px; font-size: 13pt; font-weight: bold; line-height: 1.35; color: #000; }
    .doc-header-split { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; direction: ltr; }
    .doc-header-left { display: flex; flex-direction: column; align-items: center; width: 130px; min-width: 120px; direction: ltr; }
    .doc-ref-code { margin-top: 4px; font-size: 7.5pt; font-family: monospace; font-weight: 600; text-align: center; }
    .doc-header-right { text-align: right; direction: rtl; font-size: 13pt; font-weight: bold; line-height: 1.45; color: #000; }
    .doc-header-number { margin-top: 6px; font-size: 12pt; font-weight: bold; }
    .doc-title { text-align: center; font-weight: bold; font-size: 17pt; text-decoration: underline; text-underline-offset: 3px; margin: 12px 0 14px; letter-spacing: 0.5px; color: #000; }
    .doc-intro { font-weight: bold; font-size: 14pt; margin-top: 10px; margin-bottom: 6px; color: #000; }
    .doc-whereas { margin: 0 0 7px; padding-right: 14px; text-indent: -14px; text-align: justify; font-size: 13.8pt; line-height: 1.56; color: #111827; }
    .doc-decides { text-align: center; font-weight: bold; margin: 12px 0 14px; letter-spacing: 1.5px; font-size: 14.5pt; color: #000; }
    .doc-sick-article-block { margin-bottom: 15px; font-size: 13.8pt; line-height: 1.58; text-align: justify; color: #000; }
    .doc-sick-article-block strong { font-weight: bold; font-size: 14.5pt; color: #000; }
    .doc-remark { margin-top: 6px; margin-bottom: 8px; font-size: 13pt; font-weight: bold; }
    .doc-remark-label { text-decoration: underline; }
    .doc-signature { margin-top: 15px; margin-bottom: 8px; width: 260px; margin-left: 14px; margin-right: auto; margin-inline-start: auto; margin-inline-end: 14px; text-align: center; page-break-inside: avoid; }
    .doc-signature-place { font-size: 13.5pt; color: #111827; text-align: center; }
    .doc-stamp-area { height: 17mm; }
    .doc-signature-title { font-weight: bold; font-size: 14pt; color: #000; text-align: center; }
    .admin-date { direction: ltr; unicode-bidi: isolate; font-family: Arial, sans-serif; font-weight: bold; display: inline-block; }
  </style>
</head>
<body>
  <div class="leave-doc-page sick-leave-doc">
    <div class="doc-header">
      <div class="doc-header-top">
        <div>الجمهورية الجزائرية الديمقراطية الشعبية</div>
        <div>وزارة المالية</div>
      </div>
      <div class="doc-header-split">
        <div class="doc-header-left">
          <div class="doc-ref-code">${data.referenceCode || ""}</div>
        </div>
        <div class="doc-header-right">
          <div>المديرية العامة للأملاك الوطنية</div>
          <div>المديرية الجهوية للأملاك الوطنية بالشلف</div>
          <div>المديرية الفرعية للإدارة العامة</div>
          <div class="doc-header-number">رقم: ................... /م.ج.أ.و.ش/${new Date().getFullYear()}</div>
        </div>
      </div>
    </div>

    <div class="doc-title">${docTitle}</div>
    <div class="doc-intro">إن وزير المالية،</div>

    <p class="doc-whereas">- ${SICK_LEAVE_SOCIAL_SECURITY_LAW}</p>
    <p class="doc-whereas">- ${isContractual ? CONTRACTUAL_STAFF_DECREE : CIVIL_SERVICE_ORDINANCE}</p>
    <p class="doc-whereas">- وبمقتضى مقرر تعيين ${g.title} <strong>${empFullName}</strong> ${g.bisifat} <strong>${emp.rank}</strong> لدى المديرية الجهوية للأملاك الوطنية بالشلف،</p>
    <p class="doc-whereas">- وبعد الإطلاع على الشهادة الطبية الصادرة عن ${firstDoctorText} والمؤرخة في <span dir="ltr" class="admin-date">${lv.certificateDate || "............."}</span>،</p>
    ${secondCertHtml}
    <p class="doc-whereas">${SICK_LEAVE_PROPOSAL}</p>

    <div class="doc-decides">يـقـرر ما يلي :</div>

    <div class="doc-sick-article-block">
      <strong>المادة الأولى :</strong> تمنح <strong>${leaveName}</strong> مدتها <strong>${lv.daysInWords} (<bdi dir="ltr">${lv.days}</bdi>) يوم</strong> متتالية لفائدة ${g.title} <strong>${empFullName}</strong> ${g.bisifat} <strong>${emp.rank}</strong> لدى المديرية الجهوية للأملاك الوطنية بالشلف، إبتداءا من تاريخ <strong><span dir="ltr" class="admin-date">${lv.startDate}</span></strong> إلى غاية <strong><span dir="ltr" class="admin-date">${lv.endDate}</span></strong>.
    </div>

    <div class="doc-sick-article-block">
      <strong>المادة الثانية :</strong> يقتطع من مرتب ${g.maani} المدة المذكورة في المادة الأولى من هذا المقرر.
    </div>

    <div class="doc-sick-article-block">
      <strong>المادة الثالثة :</strong> يكلف السيد المدير الفرعي للإدارة العامة بتنفيذ هذا المقرر.
    </div>

    ${notesHtml}

    <div class="doc-signature">
      <div class="doc-signature-place">حرر بالشلف في ${data.signature?.date || "............."}</div>
      <div class="doc-stamp-area"></div>
      <div class="doc-signature-title">المدير الفرعي</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Dynamically loads LeavePrintDocument on-demand and renders it into a hidden iframe for printing.
 * Avoids bundling heavy print CSS and SVG QR code engines in initial route chunks.
 */
export async function printLeaveInIframe(printData) {
  // Dynamically import heavy component on-demand
  const { default: LeavePrintDocument } = await import('../components/Leaves/LeavePrintDocument');

  const docTitle = printData?.leaveType === 'عطلة أمومة'
    ? 'مقرر عطلة أمومة'
    : (printData?.leaveType === 'عطلة مرضية' ? 'مقرر عطلة مرضية' : 'سند عطلة سنوية');

  return new Promise((resolve) => {
    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "210mm";
    iframe.style.height = "297mm";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    // Write the base HTML structure
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
      height: 100%;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      font-family: 'Amiri', 'Traditional Arabic', Arial, sans-serif;
    }
    @page {
      size: A4 portrait;
      margin: 10mm 15mm 12mm 15mm;
    }
    @media print {
      html, body {
        height: 100%;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .print-page, .leave-doc-page {
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        max-height: 297mm;
        overflow: hidden !important;
        box-sizing: border-box !important;
        padding-bottom: 12mm !important;
      }
    }
  </style>
</head>
<body>
  <div id="print-root"></div>
</body>
</html>`);
    iframeDoc.close();

    // Render the React component into the iframe
    const mountPoint = iframeDoc.getElementById("print-root");
    const root = createRoot(mountPoint);
    root.render(
      React.createElement(LeavePrintDocument, printData)
    );

    // Wait for fonts and rendering, then print
    const attemptPrint = () => {
      const pageContent = iframeDoc.querySelector(".leave-doc-page");

      if (!pageContent) {
        setTimeout(attemptPrint, 100);
        return;
      }

      const printNow = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Print failed:", e);
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

    setTimeout(attemptPrint, 300);
  });
}

/**
 * Unified helper: builds print payload and triggers iframe print with dynamic chunk loading.
 */
export async function printLeaveCertificate(stateRecord, fallbackEmployee = null) {
  const printData = buildPrintDataFromState(stateRecord, fallbackEmployee);
  await printLeaveInIframe(printData);
}
