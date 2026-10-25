const prisma = require("../src/config/database");

async function migrate() {
  console.log("Starting migration for Second Medical Certificate columns on EmployeeStates...");

  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'SecondDoctorName')
      BEGIN
        ALTER TABLE [dbo].[EmployeeStates] ADD [SecondDoctorName] NVARCHAR(200) NULL;
        PRINT 'Added column SecondDoctorName';
      END
      ELSE
      BEGIN
        PRINT 'Column SecondDoctorName already exists';
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'SecondCertificateDate')
      BEGIN
        ALTER TABLE [dbo].[EmployeeStates] ADD [SecondCertificateDate] DATETIME2 NULL;
        PRINT 'Added column SecondCertificateDate';
      END
      ELSE
      BEGIN
        PRINT 'Column SecondCertificateDate already exists';
      END
    `);

    console.log("✅ Successfully applied SQL migration for SecondDoctorName and SecondCertificateDate.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
