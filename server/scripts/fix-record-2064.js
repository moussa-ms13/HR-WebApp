const prisma = require("../src/config/database");

async function fix() {
  try {
    const updated = await prisma.employeeStates.update({
      where: { Id: 2064 },
      data: {
        DoctorName: "المؤسسة العمومية الإستشفائية",
        CertificateDate: new Date("2026-10-04"),
        SecondDoctorName: "BOUNEDJMA FATIHA",
        SecondCertificateDate: new Date("2026-10-08")
      }
    });
    console.log("Updated record 2064:", updated);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
