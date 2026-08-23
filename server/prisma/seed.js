// ============================================================
// Database Verification Script — READ ONLY
// Verifies connectivity to the existing RafatDB database
// and prints table record counts. NEVER modifies data.
//
// Run with: npm run seed
// ============================================================
const prisma = require("../src/config/database");

async function main() {
  console.log("🔍 Verifying database connectivity (READ ONLY)...\n");

  const usersCount = await prisma.users.count();
  const rolesCount = await prisma.roles.count();
  const systemRecordsCount = await prisma.systemRecords.count();
  const employeesCount = await prisma.employees.count();
  const employeeFilesCount = await prisma.employeeFiles.count();
  const employeesRecordsCount = await prisma.employeesRecords.count();
  const employeeStatesCount = await prisma.employeeStates.count();
  const jobTitlesCount = await prisma.jobTitles.count();

  console.log("  ┌─────────────────────┬───────────┐");
  console.log("  │ Table               │ Records   │");
  console.log("  ├─────────────────────┼───────────┤");
  console.log(`  │ Users               │ ${String(usersCount).padStart(9)} │`);
  console.log(`  │ Roles               │ ${String(rolesCount).padStart(9)} │`);
  console.log(`  │ SystemRecords       │ ${String(systemRecordsCount).padStart(9)} │`);
  console.log(`  │ Employees           │ ${String(employeesCount).padStart(9)} │`);
  console.log(`  │ EmployeeFiles       │ ${String(employeeFilesCount).padStart(9)} │`);
  console.log(`  │ EmployeesRecords    │ ${String(employeesRecordsCount).padStart(9)} │`);
  console.log(`  │ EmployeeStates      │ ${String(employeeStatesCount).padStart(9)} │`);
  console.log(`  │ JobTitles           │ ${String(jobTitlesCount).padStart(9)} │`);
  console.log("  └─────────────────────┴───────────┘");

  // Verify a sample user login (read-only)
  const sampleUser = await prisma.users.findFirst({
    include: { Roles: true },
  });

  if (sampleUser) {
    console.log(`\n  ✅ Sample user found: ${sampleUser.FullName} (${sampleUser.Role})`);
    console.log(`     Permissions: ${sampleUser.Roles.length} role entries`);
  }

  console.log("\n🎉 Database connectivity verified — all tables accessible!");
}

main()
  .catch((e) => {
    console.error("❌ Database verification failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
