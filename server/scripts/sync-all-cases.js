const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const prisma = require("../src/config/database");

const CASE_TYPE_STATUS_MAP = Object.freeze({
  "نقل": "منقول",
  "انتداب": "منتدب",
  "تحويل": "محوّل",
  "استيداع": "مستودع",
  "في استيداع": "مستودع",
  "استقالة": "مستقيل",
  "تقاعد": "متقاعد",
});

async function syncAllCases() {
  console.log("=== COMPREHENSIVE SPECIAL CASES & EMPLOYEE STATUS SYNC ===");

  try {
    // 1. Fetch all active SpecialCases
    const activeCases = await prisma.specialCases.findMany({
      where: { IsActive: true },
      orderBy: { Id: "asc" },
      include: {
        Employee: {
          select: {
            Id: true,
            Name: true,
            LastName: true,
            EmployeeStatus: true,
            AssignedPosition: true,
            Province: true,
            Directorate: true,
          },
        },
      },
    });

    console.log(`Found ${activeCases.length} active special case records in total.`);

    const updatedEmployees = [];

    for (const sc of activeCases) {
      const mappedStatus = CASE_TYPE_STATUS_MAP[sc.CaseType];
      if (!mappedStatus) {
        console.warn(`[WARN] Unknown CaseType "${sc.CaseType}" for SpecialCase ID ${sc.Id} (Employee ${sc.EmployeesId})`);
        continue;
      }

      const updateData = {
        EmployeeStatus: mappedStatus,
        StatusDate: sc.StartDate ? new Date(sc.StartDate) : new Date(),
        UpdateDate: new Date(),
      };

      if (sc.CaseType === "انتداب" && sc.Destination) {
        updateData.AssignedPosition = sc.Destination;
      }

      await prisma.employees.update({
        where: { Id: sc.EmployeesId },
        data: updateData,
      });

      updatedEmployees.push({
        employeeId: sc.EmployeesId,
        name: sc.Employee ? `${sc.Employee.Name} ${sc.Employee.LastName}` : "Unknown",
        province: sc.Employee?.Province || "N/A",
        caseType: sc.CaseType,
        destination: sc.Destination || "—",
        oldStatus: sc.Employee?.EmployeeStatus,
        newStatus: mappedStatus,
      });
    }

    console.log("\n=== UPDATED EMPLOYEES SUMMARY ===");
    console.table(updatedEmployees);

    // Verify specifically for 3226 and 3227
    const checkIds = [3226, 3227];
    console.log("\n=== SPECIFIC EMPLOYEE VERIFICATION ===");
    for (const id of checkIds) {
      const emp = await prisma.employees.findUnique({
        where: { Id: id },
        select: {
          Id: true,
          Name: true,
          LastName: true,
          Province: true,
          Directorate: true,
          EmployeeStatus: true,
          AssignedPosition: true,
          SpecialCases: {
            where: { IsActive: true },
            select: { Id: true, CaseType: true, Destination: true, IsActive: true },
          },
        },
      });
      console.log(`Employee ID ${id}:`, emp ? JSON.stringify(emp, null, 2) : "Not found");
    }

    console.log("\n=== SYNC COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("Sync error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncAllCases();
