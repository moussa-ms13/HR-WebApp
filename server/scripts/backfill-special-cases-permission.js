const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const prisma = require("../src/config/database");

async function backfillSpecialCasesPermission() {
  console.log("=== STARTING BACKFILL: checkBoxSpecialCases ===");
  try {
    const users = await prisma.users.findMany({
      include: {
        Roles: true,
      },
      orderBy: { Id: "asc" },
    });

    console.log(`Found ${users.length} user(s) in database.`);
    let createdCount = 0;
    let existingCount = 0;

    for (const user of users) {
      const existingSpecialCasesRole = user.Roles.find(
        (r) => r.Key === "checkBoxSpecialCases"
      );

      if (existingSpecialCasesRole) {
        existingCount++;
        console.log(
          `User [${user.Id}] ${user.UserName}: checkBoxSpecialCases already exists (Value: ${existingSpecialCasesRole.Value}). Skipping.`
        );
        continue;
      }

      // Check if user has checkBoxLeaves === true or is Admin
      const isAdmin = user.Role === "Admin";
      const hasLeaves = user.Roles.some(
        (r) => r.Key === "checkBoxLeaves" && r.Value === true
      );
      const shouldHaveSpecialCases = isAdmin || hasLeaves;

      await prisma.roles.create({
        data: {
          UsersId: user.Id,
          Key: "checkBoxSpecialCases",
          Value: shouldHaveSpecialCases,
        },
      });

      createdCount++;
      console.log(
        `User [${user.Id}] ${user.UserName}: Added checkBoxSpecialCases = ${shouldHaveSpecialCases} (Admin: ${isAdmin}, hasLeaves: ${hasLeaves}).`
      );
    }

    console.log("\n=== BACKFILL COMPLETE ===");
    console.log(`Total users checked: ${users.length}`);
    console.log(`Already configured:  ${existingCount}`);
    console.log(`Newly created:       ${createdCount}`);
  } catch (err) {
    console.error("Backfill failed with error:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

backfillSpecialCasesPermission();
