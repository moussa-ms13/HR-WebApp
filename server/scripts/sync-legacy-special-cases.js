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

async function syncLegacySpecialCases() {
  console.log("=== STARTING LEGACY SPECIAL CASES SYNC ===");

  try {
    // 1. Query all currently active records from SpecialCases
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
          },
        },
      },
    });

    console.log(`Found ${activeCases.length} active special case records.`);

    let updatedCount = 0;
    const updatedDetails = [];

    for (const sc of activeCases) {
      const mappedStatus = CASE_TYPE_STATUS_MAP[sc.CaseType];
      if (!mappedStatus) {
        console.warn(`[WARN] Unknown CaseType "${sc.CaseType}" for SpecialCase ID ${sc.Id} (Employee ${sc.EmployeesId}). Skipping status sync.`);
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

      updatedCount++;
      updatedDetails.push({
        caseId: sc.Id,
        employeeId: sc.EmployeesId,
        name: sc.Employee ? `${sc.Employee.Name} ${sc.Employee.LastName}` : "Unknown",
        caseType: sc.CaseType,
        oldStatus: sc.Employee?.EmployeeStatus,
        newStatus: mappedStatus,
        destination: sc.Destination || null,
      });

      console.log(
        `✓ Updated Employee #${sc.EmployeesId} (${sc.Employee?.Name} ${sc.Employee?.LastName}): "${sc.Employee?.EmployeeStatus}" -> "${mappedStatus}" (Case: ${sc.CaseType})`
      );
    }

    console.log("\n=== SYNC SUMMARY ===");
    console.log(`Total active cases found: ${activeCases.length}`);
    console.log(`Total employees updated: ${updatedCount}`);
    console.table(updatedDetails);

    // Specifically verify Employee 3226
    const emp3226 = await prisma.employees.findUnique({
      where: { Id: 3226 },
      select: {
        Id: true,
        Name: true,
        LastName: true,
        EmployeeStatus: true,
        Province: true,
        AssignedPosition: true,
      },
    });

    if (emp3226) {
      console.log("\n=== VERIFICATION: Employee 3226 ===");
      console.log(JSON.stringify(emp3226, null, 2));
    } else {
      console.log("\n[INFO] Employee 3226 not found in DB.");
    }
  } catch (error) {
    console.error("Sync failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncLegacySpecialCases();
