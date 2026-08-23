-- ============================================================
-- HR-WebApp — Performance Indexes for SQL Server (RafatDB)
-- 
-- These indexes target the three slowest pages:
--   1. Dashboard (aggregation queries)
--   2. Jobs/Positions (listing + duplicate checks)
--   3. System Logs (paginated listing with search)
--
-- NOTE: NVarChar(Max) columns CANNOT be indexed directly.
-- We use computed columns with LEFT() to create indexable
-- prefixes, then build indexes on those.
--
-- Run this script once against RafatDB via SSMS or sqlcmd.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EMPLOYEES TABLE
-- ────────────────────────────────────────────────────────────

-- 1a. Foreign key index (already declared in Prisma, ensure it exists)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_JobTitleId' AND object_id = OBJECT_ID('Employees'))
    CREATE NONCLUSTERED INDEX IX_Employees_JobTitleId ON Employees(JobTitleId);
GO

-- 1b. Province prefix index (used in WHERE filters, GROUP BY for dashboard)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Province_Idx')
    ALTER TABLE Employees ADD Province_Idx AS LEFT(Province, 200) PERSISTED;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Province' AND object_id = OBJECT_ID('Employees'))
    CREATE NONCLUSTERED INDEX IX_Employees_Province ON Employees(Province_Idx);
GO

-- 1c. EmployeeStatus prefix index (used in dashboard active count filters)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'EmployeeStatus_Idx')
    ALTER TABLE Employees ADD EmployeeStatus_Idx AS LEFT(EmployeeStatus, 100) PERSISTED;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Status' AND object_id = OBJECT_ID('Employees'))
    CREATE NONCLUSTERED INDEX IX_Employees_Status ON Employees(EmployeeStatus_Idx);
GO

-- ────────────────────────────────────────────────────────────
-- 2. EMPLOYEE STATES TABLE (Leaves)
-- ────────────────────────────────────────────────────────────

-- 2a. FK index for JOIN back to Employees
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EmployeesId' AND object_id = OBJECT_ID('EmployeeStates'))
    CREATE NONCLUSTERED INDEX IX_EmployeeStates_EmployeesId ON EmployeeStates(EmployeesId);
GO

-- 2b. Composite index for dashboard "active leaves" and "resuming soon" queries
--     WHERE IsResumed = false AND EndDate >= today ORDER BY EndDate
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_Active' AND object_id = OBJECT_ID('EmployeeStates'))
    CREATE NONCLUSTERED INDEX IX_EmployeeStates_Active ON EmployeeStates(IsResumed, EndDate)
    INCLUDE (StateTypeOrReason, EmployeesId, StartDate, DaysCount);
GO

-- ────────────────────────────────────────────────────────────
-- 3. EMPLOYEE FILES TABLE
-- ────────────────────────────────────────────────────────────

-- 3a. FK index for fetching files by employee
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeFiles_EmployeesId' AND object_id = OBJECT_ID('EmployeeFiles'))
    CREATE NONCLUSTERED INDEX IX_EmployeeFiles_EmployeesId ON EmployeeFiles(EmployeesId);
GO

-- ────────────────────────────────────────────────────────────
-- 4. SYSTEM RECORDS TABLE (Audit Log — grows infinitely)
-- ────────────────────────────────────────────────────────────

-- 4a. CreatedDate DESC — critical for paginated listing (ORDER BY CreatedDate DESC)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_CreatedDate' AND object_id = OBJECT_ID('SystemRecords'))
    CREATE NONCLUSTERED INDEX IX_SystemRecords_CreatedDate ON SystemRecords(CreatedDate DESC)
    INCLUDE (UserFullName, Title, Description, UsersId, EmployeesId);
GO

-- 4b. UsersId index — for filtering logs by user
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_UsersId' AND object_id = OBJECT_ID('SystemRecords'))
    CREATE NONCLUSTERED INDEX IX_SystemRecords_UsersId ON SystemRecords(UsersId);
GO

-- 4c. FK index for EmployeesId
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_EmployeesId' AND object_id = OBJECT_ID('SystemRecords'))
    CREATE NONCLUSTERED INDEX IX_SystemRecords_EmployeesId ON SystemRecords(EmployeesId)
    WHERE EmployeesId IS NOT NULL;
GO

-- ────────────────────────────────────────────────────────────
-- 5. EMPLOYEES RECORDS TABLE (Promotions)
-- ────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeesRecords_EmployeesId' AND object_id = OBJECT_ID('EmployeesRecords'))
    CREATE NONCLUSTERED INDEX IX_EmployeesRecords_EmployeesId ON EmployeesRecords(EmployeesId);
GO

-- ────────────────────────────────────────────────────────────
-- 6. ROLES TABLE
-- ────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Roles_UsersId' AND object_id = OBJECT_ID('Roles'))
    CREATE NONCLUSTERED INDEX IX_Roles_UsersId ON Roles(UsersId);
GO

PRINT '✅ All performance indexes created successfully.';
GO
