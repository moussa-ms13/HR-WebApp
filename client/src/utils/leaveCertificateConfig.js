// ============================================================
// Leave Certificate Configuration — Single Source of Truth
// Corps type, gender normalization, legal profiles, Arabic helpers
// ============================================================

// ─── Corps Type Normalizer ──────────────────────────────────
// Maps various Arabic/English values to "common" | "special"

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

/**
 * Normalize corps type from Employee.CorpsType or JobTitle.EmploymentCategory.
 * Returns "common" | "special" | "unknown"
 */
export function normalizeCorpsType(employee) {
  // Priority 1: Direct CorpsType field on Employee
  const corpsRaw = (employee?.CorpsType || "").trim();
  if (corpsRaw) {
    if (CORPS_COMMON_VALUES.has(corpsRaw)) return "common";
    if (CORPS_SPECIAL_VALUES.has(corpsRaw)) return "special";
    // Check partial match for "خاص"
    if (corpsRaw.includes("خاص")) return "special";
    if (corpsRaw.includes("مشترك")) return "common";
  }

  // Priority 2: EmploymentCategory from related JobTitle
  const category = (employee?.JobTitle?.EmploymentCategory || "").trim();
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
};

// ─── Footer Legend (from DOCX) ──────────────────────────────

export const LEAVE_TYPES_LEGEND =
  "سنوية – مرضية – استثنائية – زواج – إزدياد – أمومة – ختان – تعويضية – وفاة";

// ─── Arabic Number-to-Words (1–99) ──────────────────────────

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

/**
 * Convert a number (1–99) to Arabic words.
 * Returns the digit string for 0 or numbers > 99.
 */
export function numberToArabicWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num <= 0 || num > 99) return String(n);
  if (num < 20) return ONES[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  if (one === 0) return TENS[ten];
  return `${ONES[one]} و${TENS[ten]}`;
}

// ─── Timezone-Safe Date Formatter ───────────────────────────

/**
 * Format a date string to DD/MM/YYYY without timezone shift.
 * Parses the date-only portion of ISO strings to avoid ±1 day drift.
 */
export function formatDateSafe(isoString) {
  if (!isoString) return "";
  // If it looks like a date-only string (YYYY-MM-DD), use it directly
  const match = String(isoString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  // Fallback: parse and format
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
}) {
  const lines = [
    "HR-WebApp Annual Leave Certificate",
    `Reference: ${referenceCode || "N/A"}`,
    `Employee: ${employeeName || "N/A"}`,
    `Date of birth: ${dateOfBirth || "N/A"}`,
    `Leave start: ${startDate || "N/A"}`,
    `Leave end: ${endDate || "N/A"}`,
    `Resume date: ${resumeDate || "N/A"}`,
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
