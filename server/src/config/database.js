// ============================================================
// Prisma Client Singleton
// Connects to existing RafatDB via SQL Authentication
// ============================================================
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMssql } = require("@prisma/adapter-mssql");

const adapter = new PrismaMssql({
  server: process.env.DB_SERVER || "localhost",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || "RafatDB",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 30000,
    connectTimeout: 30000,
  },
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
