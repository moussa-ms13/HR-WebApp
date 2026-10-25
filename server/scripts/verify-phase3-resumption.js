// Phase 3 Verification Script — Early Resumption & Reverse-FIFO Balance Refund Engine
// Run: node server/scripts/verify-phase3-resumption.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function runVerification() {
  const prisma = require("../src/config/database");
  const EmployeeStatesService = require("../src/services/EmployeeStatesService");

  console.log("\n========================================================");
  console.log("=== Phase 3: Reverse-FIFO Resumption Engine Test ===");
  console.log("========================================================\n");

  // Step 1: Find a valid employee
  const emp = await prisma.employees.findFirst({
    select: { Id: true, Name: true, LastName: true, Province: true }
  });

  if (!emp) {
    console.error("No employee found in database.");
    process.exit(1);
  }

  console.log(`Using test employee: ${emp.Name} ${emp.LastName} (ID: ${emp.Id}, Province: ${emp.Province})`);

  const mockAdminUser = {
    id: 1,
    userName: "admin",
    fullName: "System Admin",
    role: "Admin",
    permissions: {}
  };

  const TEST_YEAR_1 = 2097; // Older year (e.g. 2024 in simulation)
  const TEST_YEAR_2 = 2098; // Newer year (e.g. 2025 in simulation)

  let testStateId = null;

  try {
    // Step 2: Set up two test balance records
    // Newer year 2098: Total 30, Consumed 2, Remaining 28 (headroom = 2)
    await prisma.leaveBalance.upsert({
      where: { EmployeeId_Year: { EmployeeId: emp.Id, Year: TEST_YEAR_2 } },
      update: { TotalDays: 30, ConsumedDays: 2, RemainingDays: 28, Notes: "Phase 3 test year 2" },
      create: { EmployeeId: emp.Id, Year: TEST_YEAR_2, TotalDays: 30, ConsumedDays: 2, RemainingDays: 28, Notes: "Phase 3 test year 2" }
    });

    // Older year 2097: Total 30, Consumed 10, Remaining 20 (headroom = 10)
    await prisma.leaveBalance.upsert({
      where: { EmployeeId_Year: { EmployeeId: emp.Id, Year: TEST_YEAR_1 } },
      update: { TotalDays: 30, ConsumedDays: 10, RemainingDays: 20, Notes: "Phase 3 test year 1" },
      create: { EmployeeId: emp.Id, Year: TEST_YEAR_1, TotalDays: 30, ConsumedDays: 10, RemainingDays: 20, Notes: "Phase 3 test year 1" }
    });

    console.log(`Setup Balances:`);
    console.log(`  Year ${TEST_YEAR_2} (Newer): Consumed=2, Remaining=28 (Headroom=2)`);
    console.log(`  Year ${TEST_YEAR_1} (Older): Consumed=10, Remaining=20 (Headroom=10)`);

    // Step 3: Create an annual leave record for 15 days
    // Start: 2098-06-01, End: 2098-06-15 (15 days)
    const startDate = new Date("2098-06-01T00:00:00.000Z");
    const endDate = new Date("2098-06-15T00:00:00.000Z");

    const leave = await prisma.employeeStates.create({
      data: {
        EmployeesId: emp.Id,
        RecordCategory: "تسجيل عطلة",
        StateTypeOrReason: "عطلة سنوية",
        CurrentJobTitle: "متصرف",
        DaysCount: 15,
        RequestedDays: 15,
        StartDate: startDate,
        EndDate: endDate,
        AddedDate: new Date(),
        UsersId: "admin",
        IsResumed: false,
        IsResumedEarly: false,
        Notes: "Phase 3 test leave"
      }
    });
    testStateId = leave.Id;
    console.log(`\nCreated Test Leave Record ID: ${leave.Id} (15 days from 2098-06-01 to 2098-06-15)`);

    // Step 4: Execute early resumption returning on 2098-06-11 (10 days consumed, 5 days to refund)
    // 5 days refund: 2 days go to 2098 (reaches 30 max), 3 days cascade to 2097 (reaches 23).
    const actualReturnDate = "2098-06-11";
    console.log(`\nExecuting resumeLeaveEarly with actualReturnDate: ${actualReturnDate}...`);

    const result = await EmployeeStatesService.resumeLeaveEarly(
      testStateId,
      { actualReturnDate, notes: "استئناف مبكر مبرر قانونياً" },
      mockAdminUser
    );

    console.log("\nResumption Result:");
    console.log("  IsResumed:", result.data.IsResumed);
    console.log("  IsResumedEarly:", result.data.IsResumedEarly);
    console.log("  New DaysCount:", result.data.DaysCount);
    console.log("  RequestedDays:", result.data.RequestedDays);
    console.log("  RefundedDays:", result.data.RefundedDays);
    console.log("  RefundedBreakdown:", result.data.RefundedBreakdown);
    console.log("  Returned Breakdown:", JSON.stringify(result.breakdown));

    // Step 5: Verify Database Values
    const b2098 = await prisma.leaveBalance.findUnique({
      where: { EmployeeId_Year: { EmployeeId: emp.Id, Year: TEST_YEAR_2 } }
    });
    const b2097 = await prisma.leaveBalance.findUnique({
      where: { EmployeeId_Year: { EmployeeId: emp.Id, Year: TEST_YEAR_1 } }
    });

    console.log("\nDatabase Verifications:");
    console.log(`  Year ${TEST_YEAR_2}: RemainingDays=${b2098.RemainingDays} (Expected 30), ConsumedDays=${b2098.ConsumedDays} (Expected 0)`);
    console.log(`  Year ${TEST_YEAR_1}: RemainingDays=${b2097.RemainingDays} (Expected 23), ConsumedDays=${b2097.ConsumedDays} (Expected 7)`);

    const parsedBreakdown = JSON.parse(result.data.RefundedBreakdown);

    let pass = true;

    if (result.data.DaysCount !== 10) {
      console.error(`  FAIL: DaysCount expected 10, got ${result.data.DaysCount}`);
      pass = false;
    } else {
      console.log("  PASS: DaysCount correctly reduced from 15 to 10.");
    }

    if (result.data.RefundedDays !== 5) {
      console.error(`  FAIL: RefundedDays expected 5, got ${result.data.RefundedDays}`);
      pass = false;
    } else {
      console.log("  PASS: RefundedDays correctly equals 5.");
    }

    if (b2098.RemainingDays !== 30 || b2098.ConsumedDays !== 0) {
      console.error(`  FAIL: Year ${TEST_YEAR_2} values mismatch`);
      pass = false;
    } else {
      console.log(`  PASS: Year ${TEST_YEAR_2} capped at exactly 30 Remaining (0 Consumed).`);
    }

    if (b2097.RemainingDays !== 23 || b2097.ConsumedDays !== 7) {
      console.error(`  FAIL: Year ${TEST_YEAR_1} values mismatch`);
      pass = false;
    } else {
      console.log(`  PASS: Year ${TEST_YEAR_1} received cascaded 3 days (Remaining: 23, Consumed: 7).`);
    }

    if (b2098.RemainingDays > 30 || b2097.RemainingDays > 30) {
      console.error("  FAIL: Balance exceeded 30!");
      pass = false;
    } else {
      console.log("  PASS: No balance exceeded 30.");
    }

    if (parsedBreakdown.length === 2 &&
        parsedBreakdown[0].year === TEST_YEAR_2 && parsedBreakdown[0].refunded === 2 &&
        parsedBreakdown[1].year === TEST_YEAR_1 && parsedBreakdown[1].refunded === 3) {
      console.log("  PASS: RefundedBreakdown JSON matches Reverse-FIFO split [ { 2098: 2 }, { 2097: 3 } ].");
    } else {
      console.error("  FAIL: RefundedBreakdown JSON unexpected:", parsedBreakdown);
      pass = false;
    }

    // Step 6: Test Re-resumption rejection
    console.log("\nTesting idempotency / duplicate resumption rejection:");
    try {
      await EmployeeStatesService.resumeLeaveEarly(testStateId, { actualReturnDate }, mockAdminUser);
      console.error("  FAIL: Did not reject second resumption!");
      pass = false;
    } catch (err) {
      console.log(`  PASS: Correctly rejected already resumed record (${err.message}).`);
    }

    if (pass) {
      console.log("\n========================================================");
      console.log("=== ALL PHASE 3 VERIFICATION TESTS PASSED (100%) ===");
      console.log("========================================================\n");
    } else {
      console.error("\nSome tests failed.");
      process.exit(1);
    }
  } finally {
    // Cleanup test records
    console.log("Cleaning up test records...");
    if (testStateId) {
      await prisma.employeeStates.delete({ where: { Id: testStateId } }).catch(() => {});
    }
    await prisma.leaveBalance.deleteMany({
      where: { EmployeeId: emp.Id, Year: { in: [TEST_YEAR_1, TEST_YEAR_2] } }
    }).catch(() => {});
    console.log("Cleanup complete.");
    await prisma.$disconnect();
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
