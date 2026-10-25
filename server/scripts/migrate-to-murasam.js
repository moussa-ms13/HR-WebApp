const prisma = require("../src/config/database");

async function main() {
  console.log("=== Starting Migration to Normalized Legal Statuses (مرسم / متربص) ===");

  // 1. Update "مثبت" and "نشط" -> "مرسم"
  const updatedMurasam = await prisma.employees.updateMany({
    where: {
      EmployeeStatus: { in: ["مثبت", "نشط"] },
    },
    data: {
      EmployeeStatus: "مرسم",
      UpdateDate: new Date(),
    },
  });
  console.log(`Updated ${updatedMurasam.count} employees from ['مثبت', 'نشط'] -> 'مرسم'.`);

  // 2. For employees currently having temporary movement strings ('منقول', 'محوّل', 'منتدب', 'مستودع')
  const movementEmployees = await prisma.employees.findMany({
    where: {
      EmployeeStatus: { in: ["منقول", "محوّل", "منتدب", "مستودع", "في استيداع"] },
    },
    select: {
      Id: true,
      Name: true,
      LastName: true,
      ConfirmationDate: true,
      EmployeeStatus: true,
    },
  });

  console.log(`Found ${movementEmployees.length} employees with temporary movement status strings.`);

  let restoredToMurasam = 0;
  let restoredToMutarabis = 0;

  for (const emp of movementEmployees) {
    const targetStatus = emp.ConfirmationDate ? "مرسم" : "متربص";
    await prisma.employees.update({
      where: { Id: emp.Id },
      data: {
        EmployeeStatus: targetStatus,
        UpdateDate: new Date(),
      },
    });

    if (targetStatus === "مرسم") restoredToMurasam++;
    else restoredToMutarabis++;

    console.log(
      `  - Employee ${emp.Id} (${emp.Name} ${emp.LastName}): was '${emp.EmployeeStatus}' -> restored to '${targetStatus}' (ConfirmationDate: ${emp.ConfirmationDate ? emp.ConfirmationDate.toISOString().split("T")[0] : "null"})`
    );
  }

  console.log(`Restored ${restoredToMurasam} to 'مرسم' and ${restoredToMutarabis} to 'متربص'.`);

  // 3. Final verification of status distribution
  const finalSummary = await prisma.employees.groupBy({
    by: ["EmployeeStatus"],
    _count: { Id: true },
  });

  console.log("\n=== Final EmployeeStatus Distribution ===");
  console.table(finalSummary.map((s) => ({ Status: s.EmployeeStatus, Count: s._count.Id })));
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
