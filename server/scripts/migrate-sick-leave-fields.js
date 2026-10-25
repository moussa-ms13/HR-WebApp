const prisma = require("../src/config/database");

async function migrate() {
  console.log("Starting migration for Sick Leave columns on EmployeeStates...");

  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'DoctorName')
      BEGIN
        ALTER TABLE [dbo].[EmployeeStates] ADD [DoctorName] NVARCHAR(200) NULL;
        PRINT 'Added column DoctorName';
      END
      ELSE
      BEGIN
        PRINT 'Column DoctorName already exists';
      END

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'CertificateDate')
      BEGIN
        ALTER TABLE [dbo].[EmployeeStates] ADD [CertificateDate] DATETIME2 NULL;
        PRINT 'Added column CertificateDate';
      END
      ELSE
      BEGIN
        PRINT 'Column CertificateDate already exists';
      END
    `);

    console.log("✅ Successfully applied SQL migration for DoctorName and CertificateDate.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
