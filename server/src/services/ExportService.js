const excel = require("exceljs");
const prisma = require("../config/database");

class ExportService {
  /**
   * Generates an Excel file containing the core employee list and streams it to the response.
   * @param {Object} res - Express response object
   */
  static async exportEmployeesToExcel(res) {
    // 1. Fetch only core fields to keep it lightweight (WAN optimization)
    const employees = await prisma.employees.findMany({
      select: {
        Id: true,
        Name: true,
        LastName: true,
        Province: true,
        EmployeeStatus: true,
        JobTitle: {
          select: { RankName: true },
        },
        Department: true,
        InstallationDate: true,
      },
      orderBy: { Id: 'asc' },
    });

    // 2. Setup Workbook and Worksheet
    const workbook = new excel.Workbook();
    workbook.creator = "HR-WebApp";
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet("Employees");

    // 3. Define Columns
    worksheet.columns = [
      { header: "الرقم الوظيفي", key: "id", width: 15 },
      { header: "الاسم", key: "name", width: 20 },
      { header: "اللقب", key: "lastName", width: 20 },
      { header: "الرتبة", key: "jobTitle", width: 30 },
      { header: "المديرية/المصلحة", key: "department", width: 30 },
      { header: "الولاية", key: "province", width: 20 },
      { header: "الحالة", key: "status", width: 15 },
      { header: "تاريخ التوظيف", key: "installationDate", width: 20 },
    ];

    // Style headers
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF105B38" }, // Ministry of Finance Primary Green
    };
    worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    // 4. Add Rows
    employees.forEach((emp) => {
      worksheet.addRow({
        id: emp.Id,
        name: emp.Name,
        lastName: emp.LastName,
        jobTitle: emp.JobTitle?.RankName || "",
        department: emp.Department || "",
        province: emp.Province || "",
        status: emp.EmployeeStatus || "",
        installationDate: emp.InstallationDate 
          ? new Date(emp.InstallationDate).toLocaleDateString('ar-DZ') 
          : "",
      });
    });

    // 5. Right-to-Left (RTL) View for Arabic
    worksheet.views = [
      { rightToLeft: true }
    ];

    // 6. Set Headers and Stream
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=Employees.xlsx");
    
    await workbook.xlsx.write(res);
  }
}

module.exports = ExportService;
