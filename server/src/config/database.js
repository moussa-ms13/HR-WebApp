// ============================================================
// Prisma Client Singleton
// Connects to existing RafatDB via SQL Authentication
// ============================================================
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaMssql } = require("@prisma/adapter-mssql");

const adapter = new PrismaMssql({
  server: process.env.DB_SERVER || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || "RafatDB",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000,
    connectTimeout: 30000,
    cancelTimeout: 15000,
  },
  pool: {
    max: 30,
    min: 5,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 30000,
  },
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
