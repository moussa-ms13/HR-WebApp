-- ============================================================
-- HR-WebApp: Development Database Setup
-- ============================================================
-- Run this script in SQL Server Management Studio (SSMS)
-- to create the development database.
--
-- After creation, run: npx prisma db push (from /server)
-- to scaffold all tables from the Prisma schema.
-- ============================================================

-- 1. Create the development database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'RafatDB_Dev')
BEGIN
    CREATE DATABASE RafatDB_Dev;
    PRINT '✅ Database [RafatDB_Dev] created successfully.';
END
ELSE
BEGIN
    PRINT '⚠️  Database [RafatDB_Dev] already exists — skipping creation.';
END
GO

-- 2. Grant the application user access
USE RafatDB_Dev;
GO

-- Ensure the login exists at server level (skip if already created)
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = N'hrwebapp_user')
BEGIN
    CREATE LOGIN [hrwebapp_user] WITH PASSWORD = N'HrWebApp2026Secure';
    PRINT '✅ Login [hrwebapp_user] created.';
END
GO

-- Create the database user mapped to the login
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'hrwebapp_user')
BEGIN
    CREATE USER [hrwebapp_user] FOR LOGIN [hrwebapp_user];
    PRINT '✅ User [hrwebapp_user] created in [RafatDB_Dev].';
END
GO

-- Grant full permissions for development
ALTER ROLE db_owner ADD MEMBER [hrwebapp_user];
GO

PRINT '🎉 Development database [RafatDB_Dev] is ready.';
PRINT '   Next step: cd server && npx prisma db push';
GO
