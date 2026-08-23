const prisma = require("./src/config/database");

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SystemSettings' and xtype='U')
      CREATE TABLE SystemSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        [Key] NVARCHAR(255) NOT NULL UNIQUE,
        Value NVARCHAR(MAX) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    `);
    console.log("SystemSettings table created successfully.");
  } catch (error) {
    console.error("Failed to create table:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
