// ============================================================
// Database Seed Script — Populates RafatDB_Dev with test data
// Field names match prisma/schema.prisma EXACTLY.
//
// Creates:
//   - 1 Admin user (admin / 123456, bcrypt-hashed) + Roles rows
//   - 10 Job Titles (Ranks) linked to the admin (UsersId string)
//   - 10 Employees with realistic Algerian data
//   - RankHistory + PositionHistory for the first employee
//
// Safe to re-run: existing records are detected and skipped.
//
// Run with: npm run seed   (or: node prisma/seed.js)
// ============================================================
const bcrypt = require("bcryptjs");
const prisma = require("../src/config/database");
const { PERMISSIONS } = require("../src/config/constants");

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "123456";

async function seedAdminUser() {
  const existing = await prisma.users.findFirst({ where: { UserName: ADMIN_USERNAME } });
  if (existing) {
    console.log(`👤 Admin user '${ADMIN_USERNAME}' already exists (Id: ${existing.Id}) — skipping.`);
    return existing;
  }

  const now = new Date();
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // Grant every permission key so the admin sees the full UI
  const user = await prisma.users.create({
    data: {
      FullName: "مدير النظام",
      UserName: ADMIN_USERNAME,
      Password: hashedPassword,
      Role: "Admin",
      IsSecondaryUser: false,
      UserId: ADMIN_USERNAME,
      Phone: "0550000000",
      Email: "admin@hrwebapp.dz",
      Address: "الشلف، الجزائر",
      CreatedDate: now,
      EditedDate: now,
      Roles: {
        create: Object.values(PERMISSIONS).map((key) => ({ Key: key, Value: true })),
      },
    },
    include: { Roles: true },
  });

  console.log(`✅ Admin user created (Id: ${user.Id}) with ${user.Roles.length} permission rows.`);
  return user;
}

async function seedJobTitles(adminUserName) {
  const jobTitlesData = [
    { EmploymentCategory: "سلك الملحقين", RankName: "ملحق الإدارة", CategoryLevel: "الصنف 11", IndexNumber: 1 },
    { EmploymentCategory: "سلك الملحقين", RankName: "ملحق رئيسي للإدارة", CategoryLevel: "الصنف 12", IndexNumber: 2 },
    { EmploymentCategory: "سلك المفتشين", RankName: "مفتاح الإدارة", CategoryLevel: "الصنف 12", IndexNumber: 3 },
    { EmploymentCategory: "سلك المفتشين", RankName: "مفتاح رئيسي للإدارة", CategoryLevel: "الصنف 13", IndexNumber: 4 },
    { EmploymentCategory: "سلطانة العمل", RankName: "رئيس مكتب", CategoryLevel: "الصنف 11", IndexNumber: 5 },
    { EmploymentCategory: "سلطانة العمل", RankName: "رئيس مصلحة", CategoryLevel: "الصنف 13", IndexNumber: 6 },
    { EmploymentCategory: "سلك المهندسين", RankName: "مهندس في الإعلام الآلي", CategoryLevel: "الصنف 12", IndexNumber: 7 },
    { EmploymentCategory: "سلك المهندسين", RankName: "مهندس دولة في الإعلام الآلي", CategoryLevel: "الصنف 14", IndexNumber: 8 },
    { EmploymentCategory: "سلك المراقبين", RankName: "مراقب العمل والاستعمال", CategoryLevel: "الصنف 12", IndexNumber: 9 },
    { EmploymentCategory: "وظائف الإدارة العليا", RankName: "مدير الدراسات", CategoryLevel: "الصنف 15", IndexNumber: 10 },
  ];

  const created = [];
  for (const data of jobTitlesData) {
    let jobTitle = await prisma.jobTitles.findFirst({ where: { RankName: data.RankName } });
    if (!jobTitle) {
      jobTitle = await prisma.jobTitles.create({
        data: { ...data, AddedDate: new Date(), UsersId: adminUserName },
      });
      console.log(`🏅 Job Title created: ${jobTitle.RankName} (Id: ${jobTitle.Id})`);
    } else {
      console.log(`🏅 Job Title exists: ${jobTitle.RankName} (Id: ${jobTitle.Id}) — skipping.`);
    }
    created.push(jobTitle);
  }
  return created;
}

async function seedEmployees(jobTitles, adminUserName) {
  if (await prisma.employees.count() > 0) {
    console.log("🧑‍💼 Employees already exist — skipping employee seeding.");
    return await prisma.employees.findMany({ orderBy: { Id: "asc" } });
  }

  const employeesData = [
    { Name: "محمد", LastName: "بن عمار", Gender: "ذكر", Province: "الشلف", Directorate: "مديرية السكن", Department: "مصلحة الموارد البشرية", JobIndex: 0, BirthYear: 1980, InstallYear: 2008, MaritalStatus: "متزوج", Children: 3 },
    { Name: "فاطمة", LastName: "زياني", Gender: "أنثى", Province: "تيارت", Directorate: "مديرية التربية", Department: "المصلحة الجامعية", JobIndex: 1, BirthYear: 1985, InstallYear: 2011, MaritalStatus: "متزوجة", Children: 2 },
    { Name: "عبد القادر", LastName: "حملاوي", Gender: "ذكر", Province: "تيسمسيلت", Directorate: "مديرية الشؤون الزراعية", Department: "مصلحة التجهيز", JobIndex: 2, BirthYear: 1975, InstallYear: 2003, MaritalStatus: "متزوج", Children: 4 },
    { Name: "أمينة", LastName: "بوزيد", Gender: "أنثى", Province: "عين الدفلى", Directorate: "مديرية الصحة", Department: "مصلحة المستخدمين", JobIndex: 3, BirthYear: 1990, InstallYear: 2016, MaritalStatus: "أعزب", Children: 0 },
    { Name: "يوسف", LastName: "مرابط", Gender: "ذكر", Province: "غليزان", Directorate: "مديرية المجاهدة", Department: "مصلحة المعلومات", JobIndex: 4, BirthYear: 1982, InstallYear: 2010, MaritalStatus: "متزوج", Children: 2 },
    { Name: "خديجة", LastName: "لعموري", Gender: "أنثى", Province: "قصر الشلالة", Directorate: "مديرية النشاطات الاجتماعية", Department: "مصلحة المحاسبة", JobIndex: 5, BirthYear: 1987, InstallYear: 2013, MaritalStatus: "متزوجة", Children: 1 },
    { Name: "إسماعيل", LastName: "قاسمي", Gender: "ذكر", Province: "الشلف", Directorate: "مديرية الأشغال العمومية", Department: "مصلحة الدراسات", JobIndex: 6, BirthYear: 1992, InstallYear: 2019, MaritalStatus: "أعزب", Children: 0 },
    { Name: "نور الهدى", LastName: "شريف", Gender: "أنثى", Province: "تيارت", Directorate: "مديرية التجارة", Department: "مصلحة التنظيم", JobIndex: 7, BirthYear: 1994, InstallYear: 2021, MaritalStatus: "أعزب", Children: 0 },
    { Name: "رضا", LastName: "بلحاج", Gender: "ذكر", Province: "تيسمسيلت", Directorate: "مديرية البيئة", Department: "مصلحة الوقاية", JobIndex: 8, BirthYear: 1978, InstallYear: 2005, MaritalStatus: "متزوج", Children: 3 },
    { Name: "سميرة", LastName: "عبدلي", Gender: "أنثى", Province: "غليزان", Directorate: "مديرية الثقافة", Department: "مصلحة الفنون", JobIndex: 9, BirthYear: 1983, InstallYear: 2009, MaritalStatus: "متزوجة", Children: 2 },
  ];

  const created = [];
  for (let i = 0; i < employeesData.length; i++) {
    const e = employeesData[i];
    const employee = await prisma.employees.create({
      data: {
        Name: e.Name,
        LastName: e.LastName,
        DateOfBirth: new Date(e.BirthYear, (i * 4) % 12, ((i * 7) % 27) + 1),
        PlaceOfBirth: e.Province,
        Gender: e.Gender,
        MaritalStatus: e.MaritalStatus,
        ProfileImagePath: "",
        Province: e.Province,
        Directorate: e.Directorate,
        Department: e.Department,
        AddedDate: new Date(),
        UpdateDate: new Date(),
        UsersId: adminUserName,
        NIN: `1${e.BirthYear}${String(i + 1).padStart(4, "0")}12345678`,
        SIS: `SIS${1000 + i}`,
        AssignedPosition: "",
        ConfirmationDate: new Date(e.InstallYear + 1, 0, 1),
        Degree: (i % 15) + 1,
        EmployeeStatus: "نشط",
        InstallationDate: new Date(e.InstallYear, (i * 3) % 12, ((i * 5) % 27) + 1),
        JobTitleId: jobTitles[e.JobIndex].Id,
        LastDegreeDate: new Date(e.InstallYear + 2, 0, 1),
        PositionDate: null,
        StatusDate: new Date(e.InstallYear, 0, 1),
        Address: `${e.Province} - الحي الجديد`,
        Email: `${e.Name}.${e.LastName}`.replace(/\s/g, "") + i + "@dz.gov.dz".toLowerCase(),
        NumberOfChildren: e.Children,
        PhoneNumber: `06${String(50000000 + i * 111111).slice(0, 8)}`,
      },
    });
    created.push(employee);
    console.log(`🧑‍💼 Employee created: ${employee.Name} ${employee.LastName} (${e.Province}) — Id: ${employee.Id}`);
  }
  return created;
}

async function main() {
  console.log("🌱 Seeding RafatDB_Dev...\n");

  // 1. Admin user (created first — other tables reference its username)
  const admin = await seedAdminUser();

  // 2. Job Titles (UsersId is a plain username string column, not an FK)
  const jobTitles = await seedJobTitles(admin.UserName);
  if (jobTitles.length === 0) throw new Error("No job titles available.");

  // 3. Employees
  const employees = await seedEmployees(jobTitles, admin.UserName);
  if (employees.length === 0) throw new Error("No employees available.");

  // 4. Career history for the FIRST employee only
  const first = employees[0];
  const hasRankHistory = await prisma.rankHistory.count({ where: { EmployeesId: first.Id } });
  const hasPositionHistory = await prisma.positionHistory.count({ where: { EmployeesId: first.Id } });

  if (!hasRankHistory) {
    const rankRecord = await prisma.rankHistory.create({
      data: {
        EmployeesId: first.Id,
        RankId: jobTitles[2].Id,
        RankName: jobTitles[2].RankName,
        InstallDate: new Date(2018, 8, 1),
        Reference: "قرار وزاري رقم 145 المؤرخ في 2018/08/20",
        Notes: "ترقية في الرتب بموجب الشهادة المكتسبة",
      },
    });
    console.log(`📈 RankHistory created for ${first.Name} ${first.LastName}: ${rankRecord.RankName}`);
  } else {
    console.log("📈 RankHistory already exists for first employee — skipping.");
  }

  if (!hasPositionHistory) {
    const positionRecord = await prisma.positionHistory.create({
      data: {
        EmployeesId: first.Id,
        PositionName: "رئيس مصلحة الموارد البشرية",
        InstallDate: new Date(2021, 2, 15),
        EndDate: null,
        Reference: "قرار تعيين رقم 072 المؤرخ في 2021/03/01",
      },
    });
    console.log(`💼 PositionHistory created for ${first.Name} ${first.LastName}: ${positionRecord.PositionName}`);
  } else {
    console.log("💼 PositionHistory already exists for first employee — skipping.");
  }

  // ── Summary ──
  console.log("\n📊 Final record counts:");
  const [usersCount, rolesCount, jobTitlesCount, employeesCount, rankHistoryCount, positionHistoryCount] =
    await Promise.all([
      prisma.users.count(),
      prisma.roles.count(),
      prisma.jobTitles.count(),
      prisma.employees.count(),
      prisma.rankHistory.count(),
      prisma.positionHistory.count(),
    ]);
  console.table({
    Users: usersCount,
    Roles: rolesCount,
    JobTitles: jobTitlesCount,
    Employees: employeesCount,
    RankHistory: rankHistoryCount,
    PositionHistory: positionHistoryCount,
  });

  console.log("🎉 Seeding completed successfully!");
  console.log("════════════════════════════════════════");
  console.log("  Admin credentials:");
  console.log(`    Username : ${ADMIN_USERNAME}`);
  console.log(`    Password : ${ADMIN_PASSWORD} (bcrypt-hashed in DB)`);
  console.log("════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
