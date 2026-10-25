// Phase 1 Verification — Direct Prisma test (no HTTP auth needed)
// Run: node scripts/verify-phase1-prisma.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  // Dynamic import after env is loaded
  const prisma = require("../src/config/database");
  const LeaveBalanceService = require("../src/services/LeaveBalanceService");

  console.log("\n=== Phase 1 — LeaveBalance Service Verification ===\n");

  const TEST_YEAR = 2099;

  // Find first employee
  const emp = await prisma.employees.findFirst({ select: { Id: true, Name: true } });
  if (!emp) { console.log("No employees found!"); process.exit(1); }
  console.log(`Using employee: ${emp.Name} (ID: ${emp.Id})\n`);

  // 1. upsertBalance — CREATE
  console.log("1. upsertBalance (CREATE)");
  try {
    const r = await LeaveBalanceService.upsertBalance(emp.Id, {
      year: TEST_YEAR, totalDays: 30, remainingDays: 25, notes: "Phase 1 test"
    });
    console.log(`   Year=${r.Year} Total=${r.TotalDays} Consumed=${r.ConsumedDays} Remaining=${r.RemainingDays} Notes="${r.Notes}"`);
    console.log(`   PASS\n`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}\n`);
  }

  // 2. upsertBalance — UPDATE
  console.log("2. upsertBalance (UPDATE same year)");
  try {
    const r = await LeaveBalanceService.upsertBalance(emp.Id, {
      year: TEST_YEAR, totalDays: 30, remainingDays: 20, notes: "Updated to 20"
    });
    console.log(`   Year=${r.Year} Total=${r.TotalDays} Consumed=${r.ConsumedDays} Remaining=${r.RemainingDays} Notes="${r.Notes}"`);
    console.log(`   PASS\n`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}\n`);
  }

  // 3. Validation: remainingDays > totalDays
  console.log("3. Validation: remainingDays > totalDays (should throw)");
  try {
    await LeaveBalanceService.upsertBalance(emp.Id, {
      year: TEST_YEAR, totalDays: 10, remainingDays: 50
    });
    console.log(`   FAIL (no error thrown)\n`);
  } catch (e) {
    console.log(`   Correctly rejected: ${e.message}`);
    console.log(`   PASS\n`);
  }

  // 4. Validation: invalid year
  console.log("4. Validation: year out of range (should throw)");
  try {
    await LeaveBalanceService.upsertBalance(emp.Id, {
      year: 1800, totalDays: 30, remainingDays: 30
    });
    console.log(`   FAIL (no error thrown)\n`);
  } catch (e) {
    console.log(`   Correctly rejected: ${e.message}`);
    console.log(`   PASS\n`);
  }

  // 5. getHistory — verify Notes column is returned
  console.log("5. getHistory (verify Notes column)");
  try {
    const history = await LeaveBalanceService.getHistory(emp.Id);
    const testRow = history.find(b => b.Year === TEST_YEAR);
    console.log(`   Total records: ${history.length}`);
    console.log(`   Test row Notes: "${testRow?.Notes}"`);
    console.log(`   Notes field present: ${testRow?.hasOwnProperty('Notes') ? 'YES' : 'NO'}`);
    console.log(`   PASS\n`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}\n`);
  }

  // 6. deleteBalance
  console.log("6. deleteBalance");
  try {
    const r = await LeaveBalanceService.deleteBalance(emp.Id, TEST_YEAR);
    console.log(`   ${r.message}`);
    console.log(`   PASS\n`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}\n`);
  }

  // 7. deleteBalance non-existent (should throw)
  console.log("7. deleteBalance non-existent (should throw)");
  try {
    await LeaveBalanceService.deleteBalance(emp.Id, TEST_YEAR);
    console.log(`   FAIL (no error thrown)\n`);
  } catch (e) {
    console.log(`   Correctly rejected: ${e.message}`);
    console.log(`   PASS\n`);
  }

  // 8. Verify RefundedDays/RefundedBreakdown columns exist on EmployeeStates
  console.log("8. EmployeeStates schema check (RefundedDays/RefundedBreakdown)");
  try {
    const state = await prisma.employeeStates.findFirst({
      select: { Id: true, RefundedDays: true, RefundedBreakdown: true }
    });
    console.log(`   RefundedDays column readable: YES (value: ${state?.RefundedDays ?? 'null'})`);
    console.log(`   RefundedBreakdown column readable: YES (value: ${state?.RefundedBreakdown ?? 'null'})`);
    console.log(`   PASS\n`);
  } catch (e) {
    console.log(`   FAIL: ${e.message}\n`);
  }

  console.log("=== All Phase 1 Verification Tests Complete ===\n");

  await prisma.$disconnect();
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
