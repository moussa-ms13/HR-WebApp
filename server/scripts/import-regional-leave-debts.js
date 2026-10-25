/**
 * ============================================================================
 * Migration Script: Import Official Regional Directorate Leave Debts
 * 
 * Target: 50 employees in "المديرية الجهوية للأملاك الوطنية"
 * Purges previous mock balances for years 2023, 2024, 2025, 2026
 * Inserts verified official balances according to ministerial records.
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../src/config/database');

// ── Payload (50 Employees) ──────────────────────────────────────────────────
const PAYLOAD = [
  {"num": 1, "last_name": "راهف", "first_name": "عبد القادر", "birth_date": "05/02/1967", "total_days": 40, "y2023": 0, "y2024": 0, "y2025": 10, "y2026": 30},
  {"num": 2, "last_name": "زبوج", "first_name": "هجيرة", "birth_date": "02/03/1981", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 30, "y2026": 0},
  {"num": 3, "last_name": "نقروف", "first_name": "الطاهر", "birth_date": "14/03/1973", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 4, "last_name": "نشـاد", "first_name": "حليمــة", "birth_date": "08/05/1985", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 5, "last_name": "بومدين", "first_name": "نورة", "birth_date": "17/07/1986", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 6, "last_name": "شارف", "first_name": "مليكة", "birth_date": "13/03/1982", "total_days": 57, "y2023": 0, "y2024": 0, "y2025": 27, "y2026": 30},
  {"num": 7, "last_name": "رمضاني", "first_name": "نوال", "birth_date": "12/12/1987", "total_days": 109, "y2023": 19, "y2024": 30, "y2025": 30, "y2026": 30},
  {"num": 8, "last_name": "بوسكين", "first_name": "محمد الهادي", "birth_date": "28/11/1967", "total_days": 70, "y2023": 0, "y2024": 10, "y2025": 30, "y2026": 30},
  {"num": 9, "last_name": "مختاري", "first_name": "مليكة", "birth_date": "25/10/1969", "total_days": 9, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 9},
  {"num": 10, "last_name": "طاهر طيبة", "first_name": "احمد", "birth_date": "21/01/1972", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 11, "last_name": "جعفر", "first_name": "زكرياء", "birth_date": "20/07/1985", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 12, "last_name": "شلولي", "first_name": "رشيد", "birth_date": "28/06/1988", "total_days": 46, "y2023": 0, "y2024": 0, "y2025": 16, "y2026": 30},
  {"num": 13, "last_name": "عباد", "first_name": "سعدية", "birth_date": "25/11/1977", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 14, "last_name": "رافعي", "first_name": "كريمة", "birth_date": "19/03/1979", "total_days": 9, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 9},
  {"num": 15, "last_name": "صبايحية", "first_name": "حورية", "birth_date": "02/12/1981", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 16, "last_name": "بوزيان", "first_name": "فاطمة زهرة", "birth_date": "20/07/1982", "total_days": 54, "y2023": 0, "y2024": 0, "y2025": 24, "y2026": 30},
  {"num": 17, "last_name": "عابد عياد", "first_name": "محمد", "birth_date": "26/04/1983", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 18, "last_name": "بطاش", "first_name": "حكيمة", "birth_date": "05/11/1985", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 19, "last_name": "نعاس", "first_name": "العيد", "birth_date": "02/06/1986", "total_days": 39, "y2023": 0, "y2024": 0, "y2025": 9, "y2026": 30},
  {"num": 20, "last_name": "جبور", "first_name": "حليمة", "birth_date": "09/10/1988", "total_days": 47, "y2023": 0, "y2024": 0, "y2025": 17, "y2026": 30},
  {"num": 21, "last_name": "بن الدين", "first_name": "سليم", "birth_date": "11/05/1990", "total_days": 48, "y2023": 0, "y2024": 0, "y2025": 18, "y2026": 30},
  {"num": 22, "last_name": "قوجيل", "first_name": "حياة", "birth_date": "29/12/1992", "total_days": 21, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 21},
  {"num": 23, "last_name": "دامرجي", "first_name": "نجاة", "birth_date": "09/04/1977", "total_days": 81, "y2023": 0, "y2024": 21, "y2025": 30, "y2026": 30},
  {"num": 24, "last_name": "حسون", "first_name": "لخضر", "birth_date": "07/08/1975", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 25, "last_name": "بن عابد", "first_name": "الحاج", "birth_date": "26/09/1979", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 26, "last_name": "شتاح", "first_name": "عبد القادر", "birth_date": "06/02/1986", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 27, "last_name": "صابي", "first_name": "خيرة", "birth_date": "29/06/1981", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 28, "last_name": "مداني", "first_name": "بختة", "birth_date": "27/07/1987", "total_days": 9, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 9},
  {"num": 29, "last_name": "بوجلة", "first_name": "ديلمي", "birth_date": "15/12/1968", "total_days": 60, "y2023": 0, "y2024": 0, "y2025": 30, "y2026": 30},
  {"num": 30, "last_name": "قيبو", "first_name": "عبد الله", "birth_date": "13/11/1978", "total_days": 69, "y2023": 0, "y2024": 9, "y2025": 30, "y2026": 30},
  {"num": 31, "last_name": "بلقاسمي", "first_name": "لبنى", "birth_date": "11/03/1993", "total_days": 14, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 14},
  {"num": 32, "last_name": "شايب الذراع", "first_name": "عبد الحق", "birth_date": "09/12/1991", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 33, "last_name": "زقاوي", "first_name": "فاطمة الزهراء", "birth_date": "05/05/1985", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 34, "last_name": "بوزيد", "first_name": "سميرة", "birth_date": "03/09/1986", "total_days": 48, "y2023": 0, "y2024": 0, "y2025": 18, "y2026": 30},
  {"num": 35, "last_name": "عيساوي", "first_name": "أسماء", "birth_date": "16/06/1987", "total_days": 20, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 20},
  {"num": 36, "last_name": "عابد عزي", "first_name": "ملاك", "birth_date": "01/07/2001", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 37, "last_name": "بلخير", "first_name": "سومية", "birth_date": "17/04/1972", "total_days": 60, "y2023": 0, "y2024": 0, "y2025": 30, "y2026": 30},
  {"num": 38, "last_name": "أيت أمجقان", "first_name": "عبد الهادي", "birth_date": "24/05/1972", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 39, "last_name": "عــواد", "first_name": "شريف", "birth_date": "01/04/1970", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 40, "last_name": "دادي", "first_name": "زهرة", "birth_date": "12/09/1978", "total_days": 11, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 11},
  {"num": 41, "last_name": "بوجلطية", "first_name": "ماما", "birth_date": "20/12/1964", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 42, "last_name": "خراربة", "first_name": "فاطمة", "birth_date": "17/09/1985", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 43, "last_name": "عمرون", "first_name": "زهير", "birth_date": "24/07/1981", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 44, "last_name": "زايري", "first_name": "ميلود", "birth_date": "27/03/1975", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 45, "last_name": "قريبي", "first_name": "إبراهيم", "birth_date": "02/02/1980", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 46, "last_name": "بوجلة", "first_name": "عبد الله", "birth_date": "07/11/1973", "total_days": 60, "y2023": 0, "y2024": 0, "y2025": 30, "y2026": 30},
  {"num": 47, "last_name": "بساعد", "first_name": "عبد الرحمن", "birth_date": "21/06/1977", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 48, "last_name": "مداح", "first_name": "علي", "birth_date": "19/10/1979", "total_days": 0, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 0},
  {"num": 49, "last_name": "حمادي", "first_name": "جيلالي", "birth_date": "01/01/1968", "total_days": 30, "y2023": 0, "y2024": 0, "y2025": 0, "y2026": 30},
  {"num": 50, "last_name": "محمودي", "first_name": "توفيق", "birth_date": "10/02/1970", "total_days": 45, "y2023": 0, "y2024": 0, "y2025": 15, "y2026": 30}
];

// ── Arabic Text Normalization Helpers ────────────────────────────────────────
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/diacritics
    .replace(/\u0640/g, '')                 // Remove tatweel (ـ)
    .replace(/[أإآٱ]/g, 'ا')               // Normalize Alef
    .replace(/ة/g, 'ه')                    // Normalize Taa Marbuta
    .replace(/[ىي]/g, 'ي')                 // Normalize Yaa
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/[\s\-_]+/g, ' ')             // Collapse whitespace/hyphens
    .trim();
}

function stripSpaces(text) {
  return normalizeArabic(text).replace(/\s+/g, '');
}

// ── Date Helpers ─────────────────────────────────────────────────────────────
function parsePayloadDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return { day, month, year, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
}

function extractDbDate(dateObj) {
  if (!dateObj) return null;
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return null;
  // Use UTC components to prevent local timezone shifts
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  return { day, month, year, formatted: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
}

function datesMatch(dbDate, payloadDate) {
  if (!dbDate || !payloadDate) return false;
  // Exact match
  if (dbDate.year === payloadDate.year && dbDate.month === payloadDate.month && dbDate.day === payloadDate.day) {
    return true;
  }
  // Off-by-one day tolerance for UTC/local timezone serialization
  if (dbDate.year === payloadDate.year && dbDate.month === payloadDate.month && Math.abs(dbDate.day - payloadDate.day) <= 1) {
    return true;
  }
  return false;
}

// ── Matching Engine ──────────────────────────────────────────────────────────
function findBestMatch(payloadItem, allEmployees) {
  const pLastNameNorm = normalizeArabic(payloadItem.last_name);
  const pFirstNameNorm = normalizeArabic(payloadItem.first_name);
  const pFullNameStripped = stripSpaces(`${payloadItem.last_name} ${payloadItem.first_name}`);
  const pFullNameRevStripped = stripSpaces(`${payloadItem.first_name} ${payloadItem.last_name}`);
  const pBirthDate = parsePayloadDate(payloadItem.birth_date);

  // Strategy 1: Exact normalized LastName + FirstName
  let candidates = allEmployees.filter(emp => {
    const eLast = normalizeArabic(emp.LastName);
    const eFirst = normalizeArabic(emp.Name);
    return eLast === pLastNameNorm && eFirst === pFirstNameNorm;
  });

  // Strategy 2: Exact reversed (in case first and last names were swapped)
  if (candidates.length === 0) {
    candidates = allEmployees.filter(emp => {
      const eLast = normalizeArabic(emp.LastName);
      const eFirst = normalizeArabic(emp.Name);
      return eLast === pFirstNameNorm && eFirst === pLastNameNorm;
    });
  }

  // Strategy 3: Stripped spaces match (e.g. compound names like "عبد القادر" <-> "عبدالقادر")
  if (candidates.length === 0) {
    candidates = allEmployees.filter(emp => {
      const eFullStripped = stripSpaces(`${emp.LastName} ${emp.Name}`);
      const eFullRevStripped = stripSpaces(`${emp.Name} ${emp.LastName}`);
      return eFullStripped === pFullNameStripped || eFullRevStripped === pFullNameStripped ||
             eFullStripped === pFullNameRevStripped || eFullRevStripped === pFullNameRevStripped;
    });
  }

  // Strategy 4: Fuzzy sub-string match on both parts
  if (candidates.length === 0) {
    candidates = allEmployees.filter(emp => {
      const eLast = normalizeArabic(emp.LastName);
      const eFirst = normalizeArabic(emp.Name);
      const lastMatches = eLast.includes(pLastNameNorm) || pLastNameNorm.includes(eLast);
      const firstMatches = eFirst.includes(pFirstNameNorm) || pFirstNameNorm.includes(eFirst);
      return lastMatches && firstMatches;
    });
  }

  // Disambiguate or confirm using Birth Date if multiple candidates
  if (candidates.length > 1 && pBirthDate) {
    const withDateMatch = candidates.filter(emp => {
      const eBirth = extractDbDate(emp.DateOfBirth);
      return datesMatch(eBirth, pBirthDate);
    });
    if (withDateMatch.length === 1) {
      return { match: withDateMatch[0], method: 'Name + BirthDate Disambiguation' };
    }
  }

  // Fallback: If still no match, try matching by Birth Date within the Regional Directorate
  if (candidates.length === 0 && pBirthDate) {
    const regionalEmps = allEmployees.filter(e => (e.Directorate || '').includes('الجهوية'));
    const dateMatches = regionalEmps.filter(emp => {
      const eBirth = extractDbDate(emp.DateOfBirth);
      return datesMatch(eBirth, pBirthDate);
    });
    // Check if any partial name token matches
    for (const dm of dateMatches) {
      const eFull = normalizeArabic(`${dm.LastName} ${dm.Name}`);
      const tokens = pLastNameNorm.split(' ').concat(pFirstNameNorm.split(' '));
      const hasToken = tokens.some(t => t.length > 2 && eFull.includes(t));
      if (hasToken) {
        return { match: dm, method: 'BirthDate + Name Token' };
      }
    }
  }

  if (candidates.length === 1) {
    return { match: candidates[0], method: 'Name Match' };
  }

  if (candidates.length > 1) {
    // Prefer employee in the Regional Directorate
    const regional = candidates.find(e => (e.Directorate || '').includes('الجهوية'));
    if (regional) {
      return { match: regional, method: 'Name Match (Regional Directorate Filter)' };
    }
    return { match: candidates[0], method: 'First of Multiple Name Matches', candidates };
  }

  return { match: null, method: 'No Match Found' };
}

// ── Main Migration Function ──────────────────────────────────────────────────
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n================================================================');
  console.log('  MIGRATION: IMPORT OFFICIAL REGIONAL DIRECTORATE LEAVE DEBTS');
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (Simulated, No DB Writes)' : 'EXECUTE (Live Database Modification)'}`);
  console.log('================================================================\n');

  console.log('Fetching all active employees from database...');
  const allEmployees = await prisma.employees.findMany({
    select: {
      Id: true,
      Name: true,
      LastName: true,
      DateOfBirth: true,
      Directorate: true,
      Department: true,
    }
  });
  console.log(`Loaded ${allEmployees.length} employees from database.\n`);

  let matchedCount = 0;
  let unmatchedCount = 0;
  let totalPurgedRecords = 0;
  let totalInsertedRecords = 0;

  const matchedReport = [];
  const unmatchedReport = [];

  for (const item of PAYLOAD) {
    const { match, method } = findBestMatch(item, allEmployees);

    if (!match) {
      unmatchedCount++;
      unmatchedReport.push({
        num: item.num,
        payloadName: `${item.last_name} ${item.first_name}`,
        birthDate: item.birth_date,
        totalDays: item.total_days
      });
      continue;
    }

    matchedCount++;
    const eBirth = extractDbDate(match.DateOfBirth);

    // Fetch existing balances for 2023, 2024, 2025, 2026
    const existingBalances = await prisma.leaveBalance.findMany({
      where: {
        EmployeeId: match.Id,
        Year: { in: [2023, 2024, 2025, 2026] }
      }
    });

    const purgedForEmp = existingBalances.length;
    totalPurgedRecords += purgedForEmp;

    if (!isDryRun) {
      await prisma.$transaction(async (tx) => {
        // Purge old/mock records
        await tx.leaveBalance.deleteMany({
          where: {
            EmployeeId: match.Id,
            Year: { in: [2023, 2024, 2025, 2026] }
          }
        });

        // Insert verified records
        const yearsToInsert = [
          { year: 2023, remaining: item.y2023 },
          { year: 2024, remaining: item.y2024 },
          { year: 2025, remaining: item.y2025 },
          { year: 2026, remaining: item.y2026 }
        ];

        for (const yData of yearsToInsert) {
          await tx.leaveBalance.create({
            data: {
              EmployeeId: match.Id,
              Year: yData.year,
              TotalDays: 30,
              ConsumedDays: Math.max(0, 30 - yData.remaining),
              RemainingDays: yData.remaining,
            }
          });
        }
      });
      totalInsertedRecords += 4;
    } else {
      totalInsertedRecords += 4;
    }

    matchedReport.push({
      num: item.num,
      empId: match.Id,
      dbName: `${match.LastName} ${match.Name}`,
      payloadName: `${item.last_name} ${item.first_name}`,
      birthDate: item.birth_date,
      dbBirthDate: eBirth?.formatted || 'N/A',
      totalDays: item.total_days,
      breakdown: `23:${item.y2023} | 24:${item.y2024} | 25:${item.y2025} | 26:${item.y2026}`,
      purged: purgedForEmp,
      inserted: 4,
      method
    });
  }

  // ── Print Structured Terminal Report ────────────────────────────────────────
  console.log('────────────────────────────────────────────────────────────────');
  console.log('                      MATCHED EMPLOYEES REPORT                  ');
  console.log('────────────────────────────────────────────────────────────────');
  console.table(matchedReport.map(r => ({
    '#': r.num,
    'ID': r.empId,
    'DB Name': r.dbName,
    'Payload Name': r.payloadName,
    'DOB (P/DB)': `${r.birthDate} / ${r.dbBirthDate}`,
    'Total Days': r.totalDays,
    'Remaining (23/24/25/26)': r.breakdown,
    'Purged': r.purged,
    'Method': r.method
  })));

  if (unmatchedReport.length > 0) {
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('                    UNMATCHED EMPLOYEES (ATTENTION)             ');
    console.log('────────────────────────────────────────────────────────────────');
    console.table(unmatchedReport);
  }

  console.log('\n================================================================');
  console.log('                     MIGRATION EXECUTION SUMMARY                ');
  console.log('================================================================');
  console.log(`  Total Records in Payload:    ${PAYLOAD.length}`);
  console.log(`  Successfully Matched:        ${matchedCount} / ${PAYLOAD.length}`);
  console.log(`  Unmatched:                   ${unmatchedCount}`);
  console.log(`  Total Mock Records Purged:   ${totalPurgedRecords}`);
  console.log(`  Total Real Records Inserted: ${totalInsertedRecords}`);
  console.log(`  Status:                      ${unmatchedCount === 0 ? 'SUCCESS (100% MATCHED)' : 'COMPLETED WITH WARNINGS'}`);
  console.log('================================================================\n');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('\n[FATAL ERROR] Migration failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
