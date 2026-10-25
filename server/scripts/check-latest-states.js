const prisma = require("../src/config/database");

async function check() {
  try {
    const states = await prisma.employeeStates.findMany({
      where: {
        Employee: {
          LastName: { contains: "صابي" }
        }
      },
      include: { Employee: true }
    });
    console.log("States for Sabi:", JSON.stringify(states, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
