-- ============================================================
-- Migration: Global Performance Non-Clustered Indexes
-- Optimizes query performance across Employees, EmployeeStates,
-- SpecialCases, and SystemRecords
-- ============================================================

-- 1. Employees: Province, Directorate, Department, EmployeeStatus, Name/LastName
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Province')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Province' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [Province] NVARCHAR(200) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Province' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX IX_Employees_Province ON [dbo].[Employees]([Province]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Directorate')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Directorate' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [Directorate] NVARCHAR(200) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Directorate' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX IX_Employees_Directorate ON [dbo].[Employees]([Directorate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Department')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Department' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [Department] NVARCHAR(200) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Department' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX IX_Employees_Department ON [dbo].[Employees]([Department]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'EmployeeStatus')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'EmployeeStatus' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [EmployeeStatus] NVARCHAR(100) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_EmployeeStatus' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX IX_Employees_EmployeeStatus ON [dbo].[Employees]([EmployeeStatus]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Name')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'LastName')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Name' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [Name] NVARCHAR(150) NOT NULL;
    END
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'LastName' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[Employees] ALTER COLUMN [LastName] NVARCHAR(150) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Name_LastName' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX IX_Employees_Name_LastName ON [dbo].[Employees]([Name], [LastName]);
END;

-- 2. EmployeeStates: EmployeesId, RecordCategory, StartDate, EndDate
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeStates_EmployeesId ON [dbo].[EmployeeStates]([EmployeesId]);
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'EmployeeId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EmployeeId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeStates_EmployeeId ON [dbo].[EmployeeStates]([EmployeeId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'RecordCategory')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'RecordCategory' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[EmployeeStates] ALTER COLUMN [RecordCategory] NVARCHAR(100) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_RecordCategory' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeStates_RecordCategory ON [dbo].[EmployeeStates]([RecordCategory]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'StartDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_StartDate' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeStates_StartDate ON [dbo].[EmployeeStates]([StartDate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'EndDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EndDate' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeStates_EndDate ON [dbo].[EmployeeStates]([EndDate]);
END;

-- 3. SpecialCases: EmployeesId, IsActive, CaseType
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX IX_SpecialCases_EmployeesId ON [dbo].[SpecialCases]([EmployeesId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'IsActive')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_IsActive' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX IX_SpecialCases_IsActive ON [dbo].[SpecialCases]([IsActive]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'CaseType')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'CaseType' AND max_length = -1)
    BEGIN
        ALTER TABLE [dbo].[SpecialCases] ALTER COLUMN [CaseType] NVARCHAR(100) NOT NULL;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_CaseType' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX IX_SpecialCases_CaseType ON [dbo].[SpecialCases]([CaseType]);
END;

-- 4. SystemRecords: CreatedDate, UsersId
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SystemRecords]') AND name = 'CreatedDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_CreatedDate' AND object_id = OBJECT_ID(N'[dbo].[SystemRecords]'))
        CREATE NONCLUSTERED INDEX IX_SystemRecords_CreatedDate ON [dbo].[SystemRecords]([CreatedDate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SystemRecords]') AND name = 'UsersId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_UsersId' AND object_id = OBJECT_ID(N'[dbo].[SystemRecords]'))
        CREATE NONCLUSTERED INDEX IX_SystemRecords_UsersId ON [dbo].[SystemRecords]([UsersId]);
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SystemRecords]') AND name = 'UserId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_UserId' AND object_id = OBJECT_ID(N'[dbo].[SystemRecords]'))
        CREATE NONCLUSTERED INDEX IX_SystemRecords_UserId ON [dbo].[SystemRecords]([UserId]);
END;
