const prisma = require("../config/database");
const ApiError = require("../utils/ApiError");
const SystemRecordService = require("./SystemRecordService");

class JobTitlesService {
  /**
   * Fetch all Job Titles with optional pagination/search
   */
  static async getAll(page = 1, limit = 100, search = "") {
    const skip = (page - 1) * limit;
    
    const where = search 
      ? { RankName: { contains: search } }
      : {};

    const [total, jobTitles] = await Promise.all([
      prisma.jobTitles.count({ where }),
      prisma.jobTitles.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { RankName: "asc" },
        select: {
          Id: true,
          EmploymentCategory: true,
          RankName: true,
          CategoryLevel: true,
          IndexNumber: true,
          AddedDate: true,
          _count: { select: { Employees: true } },
        },
      })
    ]);

    return {
      data: jobTitles,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single JobTitle
   */
  static async getById(id) {
    const job = await prisma.jobTitles.findUnique({ where: { Id: id } });
    if (!job) throw ApiError.notFound("Job Title not found");
    return job;
  }

  /**
   * Create JobTitle (Prevents Duplicate RankName)
   */
  static async create(data, requestingUser) {
    // Check for duplicate RankName
    const existing = await prisma.jobTitles.findFirst({
      where: { RankName: data.RankName }
    });

    if (existing) {
      throw ApiError.badRequest(`الرتبة '${data.RankName}' موجودة مسبقاً في النظام.`);
    }

    const job = await prisma.jobTitles.create({
      data: {
        EmploymentCategory: data.EmploymentCategory,
        RankName: data.RankName,
        CategoryLevel: data.CategoryLevel,
        IndexNumber: Number(data.IndexNumber) || 0,
        AddedDate: new Date(),
        UsersId: requestingUser.userName
      }
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "إضافة رتبة جديدة",
      description: `تمت إضافة الرتبة '${job.RankName}' بواسطة '${requestingUser.userName}'`,
      usersId: requestingUser.id
    });

    return job;
  }

  /**
   * Update JobTitle (Prevents Duplicate RankName)
   */
  static async update(id, data, requestingUser) {
    const job = await this.getById(id);

    // If RankName is changing, ensure it doesn't collide with another record
    if (data.RankName && data.RankName !== job.RankName) {
      const existing = await prisma.jobTitles.findFirst({
        where: { RankName: data.RankName }
      });

      if (existing) {
        throw ApiError.badRequest(`الرتبة '${data.RankName}' موجودة مسبقاً في النظام.`);
      }
    }

    const updatedJob = await prisma.jobTitles.update({
      where: { Id: id },
      data: {
        EmploymentCategory: data.EmploymentCategory ?? job.EmploymentCategory,
        RankName: data.RankName ?? job.RankName,
        CategoryLevel: data.CategoryLevel ?? job.CategoryLevel,
        IndexNumber: data.IndexNumber !== undefined ? Number(data.IndexNumber) : job.IndexNumber
      }
    });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "تعديل رتبة",
      description: `تم تعديل الرتبة '${updatedJob.RankName}' بواسطة '${requestingUser.userName}'`,
      usersId: requestingUser.id
    });

    return updatedJob;
  }

  /**
   * Delete JobTitle
   */
  static async delete(id, requestingUser) {
    const job = await this.getById(id);

    // Ensure no employees are currently using this job title?
    // According to schema, it cascades or might fail if restricted. The legacy app might just delete or warn.
    // Assuming Prisma will throw FK constraint if we try to delete an actively used job title if no cascade is set.
    // Wait, let's just delete it and let Prisma handle the throw if restricted, or we can check manually:
    
    const employeeCount = await prisma.employees.count({ where: { JobTitleId: id } });
    if (employeeCount > 0) {
      throw ApiError.badRequest("لا يمكن حذف هذه الرتبة لوجود موظفين مرتبطين بها.");
    }

    await prisma.jobTitles.delete({ where: { Id: id } });

    await SystemRecordService.log({
      userFullName: requestingUser.fullName,
      title: "حذف رتبة",
      description: `تم حذف الرتبة '${job.RankName}' بواسطة '${requestingUser.userName}'`,
      usersId: requestingUser.id
    });

    return { message: "تم الحذف بنجاح" };
  }
}

module.exports = JobTitlesService;
