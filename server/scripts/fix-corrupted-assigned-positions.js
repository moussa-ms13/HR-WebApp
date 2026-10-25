const prisma = require("../src/config/database");

async function main() {
  console.log("=== Starting Data Repair: Fix Corrupted AssignedPosition (المنصب العالي) ===");

  // 1. Fetch all special cases with a Destination
  const specialCases = await prisma.specialCases.findMany({
    where: {
      Destination: {
        not: null,
      },
    },
    select: {
      Id: true,
      EmployeesId: true,
      CaseType: true,
      Destination: true,
      IsActive: true,
    },
  });

  // Map employeeId -> set of destinations
  const empDestinationMap = new Map();
  for (const sc of specialCases) {
    const dest = (sc.Destination || "").trim();
    if (!dest) continue;
    if (!empDestinationMap.has(sc.EmployeesId)) {
      empDestinationMap.set(sc.EmployeesId, new Set());
    }
    empDestinationMap.get(sc.EmployeesId).add(dest);
  }

  // 2. Fetch candidate employees with non-empty AssignedPosition, or specifically Employee 3205
  const candidateEmployees = await prisma.employees.findMany({
    where: {
      OR: [
        { Id: 3205 },
        { AssignedPosition: { not: "" } },
      ],
    },
    select: {
      Id: true,
      Name: true,
      LastName: true,
      AssignedPosition: true,
      Province: true,
      Directorate: true,
      Department: true,
    },
  });

  const affectedEmployees = [];

  for (const emp of candidateEmployees) {
    const currentAssigned = (emp.AssignedPosition || "").trim();
    const destinations = empDestinationMap.get(emp.Id);

    const isCorruptedByDestination = destinations && destinations.has(currentAssigned);
    const isEmployee3205WithDestination =
      emp.Id === 3205 && currentAssigned === "المحافظة العقارية الشلف";

    if (isCorruptedByDestination || isEmployee3205WithDestination) {
      affectedEmployees.push(emp);
    }
  }

  console.log(`Found ${affectedEmployees.length} affected employee(s) with corrupted AssignedPosition.`);

  const repairResults = [];

  for (const emp of affectedEmployees) {
    console.log(
      `\nProcessing Employee ${emp.Id} (${emp.Name} ${emp.LastName}): Current AssignedPosition = "${emp.AssignedPosition}"`
    );

    // Look for archived PositionHistory records
    const historyRecords = await prisma.positionHistory.findMany({
      where: { EmployeesId: emp.Id },
      orderBy: { Id: "desc" },
    });

    let restoredPosition = "";
    let originFound = false;

    for (const record of historyRecords) {
      if (record.Reference && record.Reference.includes("ORIGIN:")) {
        const match = record.Reference.match(/<!--\s*ORIGIN:([\s\S]*?)-->/);
        if (match) {
          try {
            const origin = JSON.parse(match[1]);
            if (origin && origin.AssignedPosition !== undefined && origin.AssignedPosition !== null) {
              restoredPosition = String(origin.AssignedPosition).trim();
              originFound = true;
              console.log(
                `  -> Found archived origin in PositionHistory record ${record.Id}: AssignedPosition = "${restoredPosition}"`
              );
              break;
            }
          } catch (e) {
            console.warn(`  -> Failed to parse ORIGIN json in record ${record.Id}:`, e.message);
          }
        }
      }
    }

    if (!originFound) {
      console.log(`  -> No archived AssignedPosition found. Clearing to empty string "".`);
      restoredPosition = "";
    }

    // Update employee record
    await prisma.employees.update({
      where: { Id: emp.Id },
      data: {
        AssignedPosition: restoredPosition,
        UpdateDate: new Date(),
      },
    });

    console.log(
      `  -> Successfully updated Employee ${emp.Id}: AssignedPosition "${emp.AssignedPosition}" -> "${restoredPosition}"`
    );

    repairResults.push({
      Id: emp.Id,
      Name: `${emp.Name} ${emp.LastName}`,
      OldAssignedPosition: emp.AssignedPosition,
      NewAssignedPosition: restoredPosition,
    });
  }

  // 3. Specifically verify Employee 3205
  console.log("\n=== Specifically Verifying Employee 3205 ===");
  const emp3205 = await prisma.employees.findUnique({
    where: { Id: 3205 },
    select: {
      Id: true,
      Name: true,
      LastName: true,
      AssignedPosition: true,
      Province: true,
      Directorate: true,
      Department: true,
      EmployeeStatus: true,
    },
  });

  if (emp3205) {
    console.log("Employee 3205 State:", emp3205);
    if (emp3205.AssignedPosition === "المحافظة العقارية الشلف") {
      console.error("ERROR: Employee 3205 still has corrupted AssignedPosition!");
      process.exit(1);
    } else {
      console.log(
        `SUCCESS: Employee 3205 AssignedPosition is restored to "${emp3205.AssignedPosition}" (No longer "المحافظة العقارية الشلف").`
      );
    }
  } else {
    console.warn("WARNING: Employee 3205 not found in database.");
  }

  console.log("\n=== Repair Summary ===");
  if (repairResults.length > 0) {
    console.table(repairResults);
  } else {
    console.log("No records required modification.");
  }
}

main()
  .catch((err) => {
    console.error("Data repair failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
