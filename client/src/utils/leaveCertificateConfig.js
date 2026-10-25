// ============================================================
// Leave Certificate Configuration — Single Source of Truth
// Corps type, gender normalization, legal profiles, Arabic helpers
// ============================================================

// ─── Corps Type Normalizer ──────────────────────────────────
// Maps various Arabic/English values to "common" | "special" | "contractual"

const CORPS_COMMON_VALUES = new Set([
  "common",
  "سلك_مشترك",
  "سلك مشترك",
  "الأسلاك المشتركة",
  "أسلاك مشتركة",
  "مشترك",
]);

const CORPS_SPECIAL_VALUES = new Set([
  "special",
  "سلك_خاص",
  "سلك خاص",
  "الأسلاك الخاصة",
  "أسلاك خاصة",
  "خاص",
]);

const CORPS_CONTRACTUAL_VALUES = new Set([
  "contractual",
  "contract",
  "متعاقد",
  "متعاقدون",
  "متعاقدين",
  "عقد",
  "الأعوان المتعاقدون",
  "الأعوان المتعاقدين",
  "أعوان متعاقدون",
  "أعوان متعاقدين",
  "متعاقد_دوام_كلي",
  "متعاقد_دوام_جزئي",
  "متعاقدون بدوام كلي",
  "متعاقدون بدوام جزئي",
]);

export const CONTRACTUAL_TITLE_KEYWORDS = [
  "حارس",
  "سائق",
  "عامل مهني",
  "عاملة مهنية",
  "عون وقاية",
  "منظفة",
  "منظف",
  "عون خدمة",
];

function isContractualString(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (CORPS_CONTRACTUAL_VALUES.has(trimmed)) return true;
  if (
    trimmed.includes("متعاقد") ||
    trimmed.includes("أعوان متعاقد") ||
    trimmed.toLowerCase() === "contractual"
  ) {
    return true;
  }
  return false;
}

/**
 * Identify whether an employee is a contractual staff member based on:
 * - Contract type / status (e.g. emp.ContractType === 'متعاقد' or category / corps)
 * - OR rank / position (e.g. titles containing "حارس", "سائق", "عامل مهني", "عون وقاية", "منظفة", or "عون خدمة")
 */
export function isContractualEmployee(employee) {
  if (!employee) return false;

  if (typeof employee === "string") {
    return (
      isContractualString(employee) ||
      CONTRACTUAL_TITLE_KEYWORDS.some((kw) => employee.includes(kw))
    );
  }

  // 1. Check direct contract type / status / corps fields
  if (isContractualString(employee.ContractType)) return true;
  if (isContractualString(employee.corpsType)) return true;
  if (isContractualString(employee.CorpsType)) return true;
  if (isContractualString(employee.EmployeeStatus)) return true;

  // 2. Check employment category (on JobTitle or directly)
  if (isContractualString(employee.JobTitle?.EmploymentCategory)) return true;
  if (isContractualString(employee.EmploymentCategory)) return true;

  // 3. Check rank / position title strings
  const textCandidates = [
    employee.rank,
    employee.jobTitle,
    employee.RankName,
    employee.AssignedPosition,
    employee.CurrentJobTitle,
    employee.Position,
    employee.JobTitle?.RankName,
  ].filter(Boolean);

  for (const text of textCandidates) {
    if (typeof text === "string") {
      if (CONTRACTUAL_TITLE_KEYWORDS.some((kw) => text.includes(kw))) {
        return true;
      }
      if (text.includes("متعاقد")) {
        return true;
      }
    }
  }

  // 4. Nested Employee object if a state record was passed
  if (employee.Employee && typeof employee.Employee === "object") {
    if (isContractualEmployee(employee.Employee)) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize corps type from Employee.CorpsType or JobTitle.EmploymentCategory,
 * or automatic detection for contractual staff.
 * Returns "contractual" | "special" | "common" | "unknown"
 */
export function normalizeCorpsType(employee) {
  if (!employee) return "unknown";

  if (typeof employee === "string") {
    const s = employee.trim();
    if (s === "contractual" || isContractualString(s)) return "contractual";
    if (CORPS_SPECIAL_VALUES.has(s) || s.includes("خاص")) return "special";
    if (CORPS_COMMON_VALUES.has(s) || s.includes("مشترك")) return "common";
    if (CONTRACTUAL_TITLE_KEYWORDS.some((kw) => s.includes(kw))) return "contractual";
    return "unknown";
  }

  // Priority 1: Check contractual staff detection first
  if (isContractualEmployee(employee)) {
    return "contractual";
  }

  // Priority 2: Direct CorpsType field on Employee
  const corpsRaw = (employee?.CorpsType || "").trim();
  if (corpsRaw) {
    if (CORPS_COMMON_VALUES.has(corpsRaw)) return "common";
    if (CORPS_SPECIAL_VALUES.has(corpsRaw)) return "special";
    // Check partial match for "خاص"
    if (corpsRaw.includes("خاص")) return "special";
    if (corpsRaw.includes("مشترك")) return "common";
  }

  // Priority 3: EmploymentCategory from related JobTitle
  const category = (employee?.JobTitle?.EmploymentCategory || employee?.EmploymentCategory || "").trim();
  if (category) {
    if (CORPS_COMMON_VALUES.has(category)) return "common";
    if (CORPS_SPECIAL_VALUES.has(category)) return "special";
    if (category.includes("خاص")) return "special";
    if (category.includes("مشترك")) return "common";
  }

  return "unknown";
}

// ─── Gender Normalizer ──────────────────────────────────────

const GENDER_MALE_VALUES = new Set(["male", "m", "ذكر"]);
const GENDER_FEMALE_VALUES = new Set(["female", "f", "أنثى"]);

/**
 * Normalize gender to "male" | "female" | null
 */
export function normalizeGender(rawGender) {
  if (!rawGender) return null;
  const val = String(rawGender).trim().toLowerCase();
  if (GENDER_MALE_VALUES.has(val)) return "male";
  if (GENDER_FEMALE_VALUES.has(val)) return "female";
  return null;
}

// ─── Gender Profile (Arabic Pronouns) ───────────────────────

const GENDER_PROFILES = {
  male: {
    title: "السيد",
    bisifat: "بصفته",
    maani: "المعني",
    yastanif: "يستأنف عمله",
    alayh: "عليه",
    bimansibihi: "بمنصبه",
    muharrar: "المحرر",
    muwazzaf: "الموظف المعني",
  },
  female: {
    title: "السيدة",
    bisifat: "بصفتها",
    maani: "المعنية",
    yastanif: "تستأنف عملها",
    alayh: "عليها",
    bimansibihi: "بمنصبها",
    muharrar: "المحررة",
    muwazzaf: "الموظفة المعنية",
  },
};

/**
 * Get the full gender profile. Returns null if gender is invalid.
 */
export function getGenderProfile(normalizedGender) {
  return GENDER_PROFILES[normalizedGender] || null;
}

// ─── Legal Profiles per Corps Type ──────────────────────────

export const CONTRACTUAL_STAFF_DECREE =
  "وبمقتضى المرسوم الرئاسي رقم 07-308 المؤرخ في 29 سبتمبر 2007 الذي يحدد كيفيات توظيف الأعوان المتعاقدين وحقوقهم وواجباتهم والعناصر المشكلة لرواتبهم والقواعد المتعلقة بتسييرهم وكذا النظام التأديبي المطبق عليهم،";

export const SICK_LEAVE_SOCIAL_SECURITY_LAW =
  "بمقتضى القانون رقم 83-11 المؤرخ في 02 جويلية سنة 1983 والمتعلق بالضمان الإجتماعي، المعدل والمتمم،";

export const CIVIL_SERVICE_ORDINANCE =
  "وبمقتضى الأمر رقم 06-03 المؤرخ في 15 جويلية سنة 2006 المتضمن القانون الأساسي العام للوظيفة العمومية،";

export const SICK_LEAVE_PROPOSAL =
  "- وباقتراح من السيد المدير الفرعي للإدارة العامة .";

export const SICK_LEAVE_ARTICLE_3 =
  "المادة الثالثة : يكلف السيد المدير الفرعي للإدارة العامة بتنفيذ هذا المقرر.";

export const SICK_LEAVE_SIGNATORY_TITLE = "المدير الفرعي";
export const ANNUAL_LEAVE_SIGNATORY_TITLE = "المدير الفرعي";

export const LEGAL_PROFILES = {
  common: {
    label: "الأسلاك المشتركة",
    decreeText:
      "وبمقتضى المرسوم التنفيذي رقم 08-04 المؤرخ في 11 محرم عام 1429 الموافق 19 جانفي سنة 2008، " +
      "المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك المشتركة في المؤسسات والإدارات " +
      "العمومية، المعدل والمتمم،",
  },
  special: {
    label: "الأسلاك الخاصة",
    // ⚠ PLACEHOLDER — Replace with official Special Corps legal text when available
    decreeText:
      "وبمقتضى المرسوم التنفيذي رقم 10-300 المؤرخ في 23 ذي الحجة عام 1431 الموافق 29 نوفمبر سنة 2010، " +
      "المتضمن القانون الأساسي الخاص بالموظفين المنتمين للأسلاك الخاصة بالإدارة المكلفة بأملاك الدولة " +
      "والحفظ العقاري ومسح الأراضي،",
  },
  contractual: {
    label: "الأعوان المتعاقدون",
    decreeText: CONTRACTUAL_STAFF_DECREE,
  },
};

// ─── Footer Legend (from DOCX) ──────────────────────────────

export const LEAVE_TYPES_LEGEND =
  "سنوية – مرضية – استثنائية – زواج – إزدياد – أمومة – ختان – تعويضية – وفاة";

// ─── Arabic Number-to-Words (1–999+) ────────────────────────

const ONES = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة",
  "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];

const TENS = [
  "", "", "عشرون", "ثلاثون", "أربعون", "خمسون",
  "ستون", "سبعون", "ثمانون", "تسعون",
];

const HUNDREDS = [
  "", "مئة", "مئتان", "ثلاثمئة", "أربعمئة", "خمسمئة",
  "ستمئة", "سبعمئة", "ثمانمئة", "تسعمئة",
];

/**
 * Convert a number (1–999) to Arabic words.
 * Handles numbers such as 150 -> "مئة وخمسون", 98 -> "ثمانية وتسعون", etc.
 */
export function numberToArabicWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num <= 0) return String(n);
  if (num === 1000) return "ألف";
  if (num > 1000) return String(n);

  if (num < 20) return ONES[num];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    if (one === 0) return TENS[ten];
    return `${ONES[one]} و${TENS[ten]}`;
  }

  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  const hundredText = HUNDREDS[hundred];
  if (remainder === 0) return hundredText;
  return `${hundredText} و${numberToArabicWords(remainder)}`;
}

// ─── Timezone-Safe Date Formatter (Strict YYYY/MM/DD) ────────

/**
 * Format a date string strictly to YYYY/MM/DD (Year 4 digits / Month 2 digits / Day 2 digits)
 * without timezone drift, for official Algerian administrative documents.
 * e.g. "2026/10/08"
 */
export function formatAdminDate(dateInput) {
  if (!dateInput) return "";
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, "0");
      const day = isoMatch[3].padStart(2, "0");
      return `${year}/${month}/${day}`;
    }
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      return `${year}/${month}/${day}`;
    }
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Alias for formatAdminDate to preserve backward compatibility.
 */
export function formatDateSafe(isoString) {
  return formatAdminDate(isoString);
}

// ─── Algerian Administrative Date Formatter ─────────────────

export const ALGERIAN_MONTHS = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

/**
 * Format a date in official Algerian administrative format: DD [Month in Arabic text] YYYY
 * e.g. "05 أكتوبر 2026" or "28 أفريل 2026"
 */
export function formatAlgerianAdministrativeDate(dateInput) {
  if (!dateInput) return "";

  // If already formatted with an Arabic month name
  if (typeof dateInput === "string" && ALGERIAN_MONTHS.some((m) => dateInput.includes(m))) {
    return dateInput.trim();
  }

  // Handle DD/MM/YYYY numeric format
  if (typeof dateInput === "string") {
    const slashMatch = dateInput.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, "0");
      const monthIdx = parseInt(slashMatch[2], 10) - 1;
      const year = slashMatch[3];
      const month = ALGERIAN_MONTHS[monthIdx] || "";
      return `${day} ${month} ${year}`;
    }

    // Handle YYYY-MM-DD or YYYY/MM/DD string without timezone offset
    const isoMatch = dateInput.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const monthIdx = parseInt(isoMatch[2], 10) - 1;
      const day = isoMatch[3].padStart(2, "0");
      const month = ALGERIAN_MONTHS[monthIdx] || "";
      return `${day} ${month} ${year}`;
    }
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = ALGERIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Format a date as YYYYMMDD for QR reference codes.
 */
export function formatDateCompact(isoString) {
  if (!isoString) return "00000000";
  const match = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}${match[2]}${match[3]}`;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "00000000";
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

export const OFFICIAL_REGIONAL_DIRECTORATE = "المديرية الجهوية للأملاك الوطنية بالشلف";

// ─── QR Payload Builder ─────────────────────────────────────

/**
 * Build the offline informational QR text payload.
 */
export function buildQrPayload({
  referenceCode,
  employeeName,
  dateOfBirth,
  startDate,
  endDate,
  resumeDate,
  rank,
  jobTitle,
  province,
  leaveYear,
  leaveType = "عطلة سنوية",
  doctorName,
  certificateDate,
  hasSecondCertificate,
  secondDoctorName,
  secondCertificateDate,
}) {
  const isSick = leaveType === "عطلة مرضية";
  const isMaternity = leaveType === "عطلة أمومة";
  const isMedical = isSick || isMaternity;
  const docTitle = isMaternity
    ? "HR-WebApp Maternity Leave Decision (مقرر عطلة أمومة)"
    : isSick
    ? "HR-WebApp Sick Leave Decision (مقرر عطلة مرضية)"
    : "HR-WebApp Annual Leave Certificate";
  const lines = [
    docTitle,
    `Type: ${leaveType}`,
    `Reference: ${referenceCode || "N/A"}`,
    `Employee: ${employeeName || "N/A"}`,
    `Date of birth: ${dateOfBirth || "N/A"}`,
    `Leave start: ${startDate || "N/A"}`,
    `Leave end: ${endDate || "N/A"}`,
    ...(isMedical
      ? [
          `Doctor: ${doctorName || "N/A"}`,
          `Certificate date: ${certificateDate || "N/A"}`,
          ...(hasSecondCertificate && secondCertificateDate
            ? [
                `Second doctor: ${secondDoctorName || doctorName || "N/A"}`,
                `Second certificate date: ${secondCertificateDate}`,
              ]
            : []),
        ]
      : [`Resume date: ${resumeDate || "N/A"}`]),
    `Rank: ${rank || "N/A"}`,
    `Position: ${jobTitle || "/"}`,
    `Province: ${province || "N/A"}`,
    `Leave year: ${leaveYear || "N/A"}`,
  ];
  return lines.join("\n");
}

// ─── Reference Code Generator ───────────────────────────────

const ARABIC_TO_LATIN = {
  "ا":"A","أ":"A","إ":"E","آ":"A","ى":"A","ة":"A","ئ":"E","ؤ":"O",
  "ب":"B","ت":"T","ث":"TH","ج":"J","ح":"H","خ":"KH","د":"D","ذ":"DZ",
  "ر":"R","ز":"Z","س":"S","ش":"CH","ص":"S","ض":"D","ط":"T","ظ":"Z",
  "ع":"A","غ":"GH","ف":"F","ق":"K","ك":"K","ل":"L","م":"M","ن":"N",
  "ه":"H","و":"W","ي":"Y",
};

function arabicToLatin(text) {
  if (!text) return "XX";
  let result = "";
  for (const char of text) {
    result += ARABIC_TO_LATIN[char] || char;
  }
  return result.replace(/[^A-Z]/gi, "").toUpperCase();
}

/**
 * Generate a short deterministic reference code from employee + leave data.
 */
export function generateReferenceCode(firstName, lastName, dob, startDate) {
  const latName = (arabicToLatin(firstName) + "XX").substring(0, 2);
  const latLast = (arabicToLatin(lastName) + "XX").substring(0, 2);
  const dobFmt = formatDateCompact(dob);
  const startFmt = formatDateCompact(startDate);
  return `${latName}-${latLast}-${dobFmt}-${startFmt}`;
}
