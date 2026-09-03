const prisma = require("../src/config/database");

async function executeSafeMigration() {
  console.log("=== STARTING DYNAMIC SAFE SQL MIGRATION ===");

  try {
    // ----------------------------------------------------
    // STEP 2: Handle EmployeeStatus dynamically
    // ----------------------------------------------------
    console.log("\n[Step 2] Inspecting EmployeeStatus default constraint...");
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT d.name AS ConstraintName, c.name AS ColumnName, c.max_length AS MaxLength
      FROM sys.default_constraints d
      INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
      WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Employees]') AND c.name = 'EmployeeStatus';
    `);

    console.log("Found constraints on EmployeeStatus:", constraints);

    for (const row of constraints) {
      console.log(`Dropping default constraint: [${row.ConstraintName}]`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE [dbo].[Employees] DROP CONSTRAINT [${row.ConstraintName}];`
      );
      console.log(`Dropped [${row.ConstraintName}] successfully.`);
    }

    // Check if any existing index on EmployeeStatus
    const existingIdx = await prisma.$queryRawUnsafe(`
      SELECT name FROM sys.indexes 
      WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'IX_Employees_EmployeeStatus';
    `);
    if (existingIdx.length > 0) {
      console.log("Dropping existing index IX_Employees_EmployeeStatus to allow column alter...");
      await prisma.$executeRawUnsafe(`DROP INDEX [IX_Employees_EmployeeStatus] ON [dbo].[Employees];`);
    }

    console.log("Altering column [Employees].[EmployeeStatus] to NVARCHAR(50) NULL...");
    await prisma.$executeRawUnsafe(
      `ALTER TABLE [dbo].[Employees] ALTER COLUMN [EmployeeStatus] NVARCHAR(50) NULL;`
    );
    console.log("Column [Employees].[EmployeeStatus] altered to NVARCHAR(50) NULL.");

    // Check if DF_Employees_EmployeeStatus already exists
    const checkNewDf = await prisma.$queryRawUnsafe(`
      SELECT name FROM sys.default_constraints 
      WHERE parent_object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'DF_Employees_EmployeeStatus';
    `);
    if (checkNewDf.length === 0) {
      console.log("Re-adding default constraint [DF_Employees_EmployeeStatus] DEFAULT ('نشط')...");
      await prisma.$executeRawUnsafe(
        `ALTER TABLE [dbo].[Employees] ADD CONSTRAINT [DF_Employees_EmployeeStatus] DEFAULT ('نشط') FOR [EmployeeStatus];`
      );
      console.log("Default constraint [DF_Employees_EmployeeStatus] created.");
    }

    console.log("Creating non-clustered index [IX_Employees_EmployeeStatus]...");
    await prisma.$executeRawUnsafe(
      `CREATE NONCLUSTERED INDEX [IX_Employees_EmployeeStatus] ON [dbo].[Employees]([EmployeeStatus]);`
    );
    console.log("Index [IX_Employees_EmployeeStatus] created successfully.");

    // ----------------------------------------------------
    // STEP 3: Safe Index Creation for other columns
    // Skip any MAX length (-1) data types to prevent Error 1919
    // ----------------------------------------------------
    console.log("\n[Step 3] Checking and applying other indexes safely...");

    const targets = [
      {
        table: "Employees",
        index: "IX_Employees_Province",
        cols: ["Province"],
      },
      {
        table: "Employees",
        index: "IX_Employees_Directorate",
        cols: ["Directorate"],
      },
      {
        table: "Employees",
        index: "IX_Employees_Department",
        cols: ["Department"],
      },
      {
        table: "Employees",
        index: "IX_Employees_Name_LastName",
        cols: ["Name", "LastName"],
      },
      {
        table: "EmployeeStates",
        index: "IX_EmployeeStates_EmployeesId",
        cols: ["EmployeesId"],
        altCols: ["EmployeeId"],
      },
      {
        table: "EmployeeStates",
        index: "IX_EmployeeStates_RecordCategory",
        cols: ["RecordCategory"],
      },
      {
        table: "EmployeeStates",
        index: "IX_EmployeeStates_StartDate",
        cols: ["StartDate"],
      },
      {
        table: "EmployeeStates",
        index: "IX_EmployeeStates_EndDate",
        cols: ["EndDate"],
      },
      {
        table: "SpecialCases",
        index: "IX_SpecialCases_EmployeesId",
        cols: ["EmployeesId"],
        altCols: ["EmployeeId"],
      },
      {
        table: "SpecialCases",
        index: "IX_SpecialCases_IsActive",
        cols: ["IsActive"],
      },
      {
        table: "SpecialCases",
        index: "IX_SpecialCases_CaseType",
        cols: ["CaseType"],
      },
      {
        table: "SystemRecords",
        index: "IX_SystemRecords_CreatedDate",
        cols: ["CreatedDate"],
      },
      {
        table: "SystemRecords",
        index: "IX_SystemRecords_UsersId",
        cols: ["UsersId"],
        altCols: ["UserId"],
      },
      {
        table: "RankHistory",
        index: "IX_RankHistory_EmployeesId",
        cols: ["EmployeesId"],
        altCols: ["EmployeeId"],
      },
      {
        table: "PositionHistory",
        index: "IX_PositionHistory_EmployeesId",
        cols: ["EmployeesId"],
        altCols: ["EmployeeId"],
      },
      {
        table: "EmployeeFiles",
        index: "IX_EmployeeFiles_EmployeesId",
        cols: ["EmployeesId"],
        altCols: ["EmployeeId"],
      },
    ];

    for (const target of targets) {
      // 1. Verify table exists
      const tblCheck = await prisma.$queryRawUnsafe(
        `SELECT OBJECT_ID(N'[dbo].[${target.table}]') AS ObjId;`
      );
      if (!tblCheck[0] || !tblCheck[0].ObjId) {
        console.log(`Table [dbo].[${target.table}] does not exist. Skipping.`);
        continue;
      }

      // 2. Check if index already exists
      const idxCheck = await prisma.$queryRawUnsafe(`
        SELECT name FROM sys.indexes 
        WHERE name = '${target.index}' AND object_id = OBJECT_ID(N'[dbo].[${target.table}]');
      `);
      if (idxCheck.length > 0) {
        console.log(`Index [${target.index}] already exists on [${target.table}]. Skipping.`);
        continue;
      }

      // 3. Resolve columns and verify none are MAX length (-1)
      let resolvedCols = [];
      let canCreate = true;

      for (const colName of target.cols) {
        let colInfo = await prisma.$queryRawUnsafe(`
          SELECT name, max_length 
          FROM sys.columns 
          WHERE object_id = OBJECT_ID(N'[dbo].[${target.table}]') AND name = '${colName}';
        `);

        if (colInfo.length === 0 && target.altCols) {
          for (const alt of target.altCols) {
            colInfo = await prisma.$queryRawUnsafe(`
              SELECT name, max_length 
              FROM sys.columns 
              WHERE object_id = OBJECT_ID(N'[dbo].[${target.table}]') AND name = '${alt}';
            `);
            if (colInfo.length > 0) break;
          }
        }

        if (colInfo.length === 0) {
          console.log(`Column [${colName}] not found on [${target.table}]. Skipping index [${target.index}].`);
          canCreate = false;
          break;
        }

        const cData = colInfo[0];
        // Error 1919 guard: max_length == -1 means NVARCHAR(MAX)
        if (cData.max_length === -1) {
          console.log(`Column [${target.table}].[${cData.name}] has MAX length (-1). Safely skipping index [${target.index}] to avoid Error 1919.`);
          canCreate = false;
          break;
        }

        resolvedCols.push(`[${cData.name}]`);
      }

      // 4. Create index if all columns are valid
      if (canCreate && resolvedCols.length > 0) {
        const sql = `CREATE NONCLUSTERED INDEX [${target.index}] ON [dbo].[${target.table}](${resolvedCols.join(", ")});`;
        console.log(`Executing: ${sql}`);
        await prisma.$executeRawUnsafe(sql);
        console.log(`Index [${target.index}] created successfully.`);
      }
    }

    console.log("\n=== ALL MIGRATION OPERATIONS EXECUTED WITH ZERO ERRORS ===");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

executeSafeMigration();
