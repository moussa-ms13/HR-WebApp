import React from "react";
import { createRoot } from "react-dom/client";

/**
 * Formats a date into DD/MM/YYYY for official French administrative documents.
 * Ignores sentinel SQL dates (year <= 1900).
 */
export function formatFrenchDateDMY(dateInput, fallback = "../.../....") {
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
 * Resolves the employee's Latin Full Name in UPPERCASE ("ZEBOUDJ HADJIRA").
 */
export function resolveEmployeeFrenchFullName(employee) {
  if (!employee) return "";
  const lastFr = String(employee.LastNameFr || "").trim();
  const firstFr = String(employee.NameFr || "").trim();
  if (lastFr || firstFr) {
    return [lastFr, firstFr].filter(Boolean).join(" ").toUpperCase();
  }
  const lastAr = String(employee.LastName || "").trim();
  const firstAr = String(employee.Name || "").trim();
  return [lastAr, firstAr].filter(Boolean).join(" ").toUpperCase();
}

function normalizeArabicKey(str) {
  return String(str || "")
    .replace(/\u0640/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

const RANK_AR_TO_FR = {
  "مفتش رئيس": "Inspecteur en Chef",
  "مفتش قسم": "Inspecteur Divisionnaire",
  "مفتش مركزي": "Inspecteur Central",
  "مفتش رئيسي": "Inspecteur Principal",
  "مفتش": "Inspecteur",
  "عون معاينه": "Agent de Constatation",
  "متصرف رئيسي": "Administrateur Principal",
  "متصرف محلل": "Administrateur Analyste",
  "متصرف": "Administrateur",
  "كاتب مديريه رئيسي": "Secrétaire de Direction Principal",
  "كاتب مديريه": "Secrétaire de Direction",
  "كاتب": "Secrétaire",
  "تقني سام في الاعلام الالي": "Technicien Supérieur en Informatique",
  "تقني سامي في الاعلام الالي": "Technicien Supérieur en Informatique",
  "تقني في الاعلام الالي": "Technicien en Informatique",
  "مساعد مهندس مستوي 2 في الاعلام الالي": "Ingénieur Adjoint Niveau 2 en Informatique",
  "مساعد مهندس مستوي 1 في الاعلام الالي": "Ingénieur Adjoint Niveau 1 en Informatique",
  "مهندس دوله في الاعلام الالي": "Ingénieur d'État en Informatique",
  "مهندس رئيسي في الاعلام الالي": "Ingénieur Principal en Informatique",
  "مهندس دوله في الاحصائيات": "Ingénieur d'État en Statistiques",
  "مهندس رئيسي لمسح الاراضي": "Ingénieur Principal du Cadastre",
  "مهندس دوله لمسح الاراضي": "Ingénieur d'État du Cadastre",
  "تقني سامي في مسح الاراضي": "Technicien Supérieur du Cadastre",
  "تقني في مسح الاراضي": "Technicien du Cadastre",
  "وثائقي امين محفوظات رئيسي": "Documentaliste Archiviste Principal",
  "وثائقي امين محفوظات": "Documentaliste Archiviste",
  "مساعد وثائقي امين محفوظات": "Documentaliste Archiviste Adjoint",
  "ملحق رئيسي للاداره": "Attaché Principal d'Administration",
  "ملحق اداره": "Attaché d'Administration",
  "ملحق للاداره": "Attaché d'Administration",
  "محاسب اداري رئيسي": "Comptable Administratif Principal",
  "محاسب اداري": "Comptable Administratif",
  "عون اداره رئيسي": "Agent Principal d'Administration",
  "عون اداره": "Agent d'Administration",
  "عون مكتب": "Agent de Bureau",
  "عون حفظ البيانات": "Agent de Saisie",
  "حارس": "Gardien",
  "سائق سياره من الصنف الاول": "Conducteur Automobile",
  "سائق سياره من الصنف الثاني": "Conducteur Automobile",
  "سائق السياره من المستوي الاول": "Conducteur Automobile",
  "سائق سياره من المستوي الاول": "Conducteur Automobile",
  "سائق سياره من المستوي الثاني": "Conducteur Automobile",
  "رئيس حظيره": "Chef de Parc",
  "رئيس حضيره": "Chef de Parc",
  "حاجب رئيسي": "Appariteur Principal",
  "حاجب": "Appariteur",
  "عامل مهني خارج الصنف": "Ouvrier Professionnel",
  "عامل مهني من الصنف الاول": "Ouvrier Professionnel",
  "عامل مهني من الصنف الثاني": "Ouvrier Professionnel",
  "عامل مهني من الصنف الثالث": "Ouvrier Professionnel",
  "عامل مهني من المستوي الاول": "Ouvrier Professionnel",
  "عامل مهني من المستوي الثاني": "Ouvrier Professionnel",
  "عامل مهني من المستوي الثالث": "Ouvrier Professionnel",
  "عون الوقايه من المستوي الاول": "Agent de Prévention Niveau 1",
  "عون وقايه من المستوي الاول": "Agent de Prévention Niveau 1",
  "عون الوقايه من المستوي الثاني": "Agent de Prévention Niveau 2",
  "عون وقايه من المستوي الثاني": "Agent de Prévention Niveau 2",
  "عون الخدمه من المستوي الثالث": "Agent de Service Niveau 3",
  "عون خدمه من المستوي الثالث": "Agent de Service Niveau 3",
  "عون خدمه من المستوي الثاني": "Agent de Service Niveau 2",
  "عون خدمه من المستوي الاول": "Agent de Service Niveau 1",
};

export function translateRankToFrench(arabicRank) {
  const raw = String(arabicRank || "").trim();
  if (!raw || raw === "غير محدد") return "";
  const key = normalizeArabicKey(raw);
  if (RANK_AR_TO_FR[key]) return RANK_AR_TO_FR[key];
  // Partial match fallback
  for (const [arKey, frVal] of Object.entries(RANK_AR_TO_FR)) {
    if (key.includes(arKey) || arKey.includes(key)) {
      return frVal;
    }
  }
  return raw;
}

const PROVINCE_AR_TO_FR = {
  "الشلف": "Chlef",
  "عين الدفلي": "Aïn Defla",
  "تيارت": "Tiaret",
  "تيسمسيلت": "Tissemsilt",
};

const CITY_AR_TO_FR = {
  "الشلف": "Chlef",
  "تنس": "Ténès",
  "بوقادير": "Boukadir",
  "اولاد فارس": "Ouled Farès",
  "الشطيه": "Chettia",
  "وادي الفضه": "Oued Fodda",
  "العطاف": "El Attaf",
  "خميس مليانه": "Khemis Miliana",
  "مليانه": "Miliana",
  "عين الدفلي": "Aïn Defla",
  "تيارت": "Tiaret",
  "السوقر": "Sougueur",
  "فرنده": "Frenda",
  "مهديه": "Mahdia",
  "قصر الشلاله": "Ksar Chellala",
  "تيسمسيلت": "Tissemsilt",
  "ثنيه الحد": "Theniet El Had",
  "برج بونعامه": "Bordj Bounaama",
  "الجزائر": "Alger",
  "وهران": "Oran",
  "البليده": "Blida",
  "مستغانم": "Mostaganem",
  "غليزان": "Relizane",
};

export function translateBirthPlaceToFrench(arabicPlace, fallbackProvince = "") {
  const raw = String(arabicPlace || "").replace(/[()]/g, "").trim();
  if (!raw || raw === "غير محدد") {
    const provKey = normalizeArabicKey(fallbackProvince);
    return PROVINCE_AR_TO_FR[provKey] || "Chlef";
  }
  if (/^[A-Za-zÀ-ÿ\s'-]+$/.test(raw)) return raw;
  const key = normalizeArabicKey(raw);
  if (CITY_AR_TO_FR[key]) return CITY_AR_TO_FR[key];
  for (const [arCity, frCity] of Object.entries(CITY_AR_TO_FR)) {
    if (key.includes(arCity)) return frCity;
  }
  return "Chlef";
}

export function translateDirectorateToFrench(employee) {
  const dirRaw = String(employee?.Directorate || "").trim();
  const provRaw = String(employee?.Province || "الشلف").trim();
  const dirKey = normalizeArabicKey(dirRaw);
  const provKey = normalizeArabicKey(provRaw);
  const provFr = PROVINCE_AR_TO_FR[provKey] || "Chlef";

  if (!dirKey || dirKey.includes("المديريه الجهويه للاملاك الوطنيه")) {
    return "Direction REGIONALE DU DOMAINE de CHLEF";
  }
  if (dirKey.includes("مديريه املاك الدوله") || dirKey.includes("مفتشيه املاك الدوله")) {
    if (provKey === "الشلف") {
      return "Direction des Domaines de la Wilaya de Chlef";
    }
    return `Direction des Domaines de la Wilaya de ${provFr}`;
  }
  if (dirKey.includes("مسح الاراضي") || dirKey.includes("المحافظه العقاريه")) {
    return `Direction du Cadastre et de la Conservation Foncière de la Wilaya de ${provFr}`;
  }
  return "Direction REGIONALE DU DOMAINE de CHLEF";
}

const HIGH_POS_AR_TO_FR = {
  "رئيس مفتشيه": "Chef d'Inspection",
  "رئيس مصلحه": "Chef de Service",
  "رئيس مكتب": "Chef de Bureau",
  "رئيس قسم": "Chef de Section",
  "رئيس فرع": "Chef de Branche",
  "نائب مدير": "Sous Directeur",
  "المدير الفرعي": "Sous Directeur",
  "مدير فرعي": "Sous Directeur",
  "رئيس حظيره السيارات": "Chef de Parc Automobile",
  "رئيس حظيره": "Chef de Parc",
  "مكلف بالتحصيل": "Chargé du Recouvrement",
  "مكلف بالمواد المحجوزه والبيوع": "Chargé des Objets Saisis et des Ventes",
};

export function translateHighPositionToFrench(arabicPos) {
  const raw = String(arabicPos || "").trim();
  if (!raw || raw === "غير محدد" || raw === "لا شيء") return "";
  if (/^[A-Za-zÀ-ÿ\s'-]+$/.test(raw)) return raw;
  const key = normalizeArabicKey(raw);
  if (HIGH_POS_AR_TO_FR[key]) return HIGH_POS_AR_TO_FR[key];
  for (const [arKey, frVal] of Object.entries(HIGH_POS_AR_TO_FR)) {
    if (key.includes(arKey)) return frVal;
  }
  return raw;
}

/**
 * French preposition elision helper before rank names:
 * Returns "d'" before vowels or silent H (A, E, I, O, U, Y, H) and "de " otherwise.
 * Example: formatFrenchQualityPreposition("Inspecteur Central") -> { prep: "d'", rank: "Inspecteur Central", combined: "d'Inspecteur Central" }
 */
export function formatFrenchQualityPreposition(rankFr) {
  const clean = String(rankFr || "").trim();
  if (!clean) {
    return { prep: "de ", rank: "........................" };
  }
  // If user already typed d' or de at the beginning, strip it cleanly
  const stripped = clean.replace(/^(d'|de\s+)/i, "").trim();
  const firstChar = stripped
    .charAt(0)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const isVowelOrH = ["A", "E", "I", "O", "U", "Y", "H"].includes(firstChar);
  return {
    prep: isVowelOrH ? "d'" : "de ",
    rank: stripped,
  };
}

/**
 * Builds concise, scannable French QR payload for ATTESTATION DE TRAVAIL.
 */
export function buildFrenchWorkCertificateQrPayload({
  refNumber,
  year,
  issueDate,
  fullNameFr,
  rankFr,
  directorateFr,
  firstHireDate,
}) {
  const yr = year || new Date().getFullYear();
  const ref = String(refNumber || "").trim() || "-";
  return [
    `ATTESTATION DE TRAVAIL`,
    `Réf: ${ref}/DRDNC/${yr}`,
    `Date: ${formatFrenchDateDMY(issueDate, "-")}`,
    `Employé(e): ${String(fullNameFr || "").trim() || "-"}`,
    `Grade: ${String(rankFr || "").trim() || "-"}`,
    `Affectation: ${String(directorateFr || "").trim() || "-"}`,
    `Recrutement: ${formatFrenchDateDMY(firstHireDate, "-")}`,
  ].join("\n");
}

/**
 * Isolated LTR A4 Print Engine via hidden iframe for French official documents.
 */
export function printFrenchOfficialDocumentInIframe(
  Component,
  props,
  docTitle = "ATTESTATION DE TRAVAIL"
) {
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
<html dir="ltr" lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${docTitle}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      direction: ltr;
      background: white;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Calibri', 'Arial', 'Segoe UI', sans-serif;
      color: #000000;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
      .official-a4-sheet-fr {
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
  <div id="official-print-root-fr"></div>
</body>
</html>`);
    iframeDoc.close();

    const mountPoint = iframeDoc.getElementById("official-print-root-fr");
    const root = createRoot(mountPoint);
    root.render(React.createElement(Component, props));

    const attemptPrint = () => {
      const sheet = iframeDoc.querySelector(".official-a4-sheet-fr");
      if (!sheet) {
        setTimeout(attemptPrint, 100);
        return;
      }

      const printNow = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (err) {
          console.error("French official document print failed:", err);
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
        setTimeout(printNow, 500);
      }
    };

    setTimeout(attemptPrint, 250);
  });
}
