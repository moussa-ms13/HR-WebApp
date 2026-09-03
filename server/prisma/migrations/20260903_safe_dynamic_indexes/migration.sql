-- ============================================================
-- Migration: Safe Dynamic SQL Migration for Indexes and EmployeeStatus
-- Idempotent, handles dynamic default constraints, avoids Error 1919 & 3728
-- ============================================================

-- ------------------------------------------------------------
-- 1. Handle EmployeeStatus dynamically
-- ------------------------------------------------------------
DECLARE @ConstraintName NVARCHAR(200);

SELECT @ConstraintName = d.name
FROM sys.default_constraints d
INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
WHERE d.parent_object_id = OBJECT_ID(N'[dbo].[Employees]') AND c.name = 'EmployeeStatus';

IF @ConstraintName IS NOT NULL
BEGIN
    DECLARE @DropConstraintSql NVARCHAR(500) = N'ALTER TABLE [dbo].[Employees] DROP CONSTRAINT [' + @ConstraintName + N'];';
    EXEC sp_executesql @DropConstraintSql;
END;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'IX_Employees_EmployeeStatus')
BEGIN
    DROP INDEX [IX_Employees_EmployeeStatus] ON [dbo].[Employees];
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'EmployeeStatus' AND (max_length = -1 OR max_length > 100))
BEGIN
    ALTER TABLE [dbo].[Employees] ALTER COLUMN [EmployeeStatus] NVARCHAR(50) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.default_constraints 
    WHERE parent_object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'DF_Employees_EmployeeStatus'
)
BEGIN
    ALTER TABLE [dbo].[Employees] ADD CONSTRAINT [DF_Employees_EmployeeStatus] DEFAULT ('نشط') FOR [EmployeeStatus];
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'IX_Employees_EmployeeStatus')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Employees_EmployeeStatus] ON [dbo].[Employees]([EmployeeStatus]);
END;

-- ------------------------------------------------------------
-- 2. Safe Indexes for Other Tables (guard against MAX length columns)
-- ------------------------------------------------------------

-- Employees: Province, Directorate, Department (if not MAX length)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Province' AND max_length <> -1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Province' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX [IX_Employees_Province] ON [dbo].[Employees]([Province]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Directorate' AND max_length <> -1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Directorate' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX [IX_Employees_Directorate] ON [dbo].[Employees]([Directorate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND name = 'Department' AND max_length <> -1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Employees_Department' AND object_id = OBJECT_ID(N'[dbo].[Employees]'))
        CREATE NONCLUSTERED INDEX [IX_Employees_Department] ON [dbo].[Employees]([Department]);
END;

-- EmployeeStates: EmployeesId, RecordCategory, StartDate, EndDate
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX [IX_EmployeeStates_EmployeesId] ON [dbo].[EmployeeStates]([EmployeesId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'RecordCategory' AND max_length <> -1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_RecordCategory' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX [IX_EmployeeStates_RecordCategory] ON [dbo].[EmployeeStates]([RecordCategory]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'StartDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_StartDate' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX [IX_EmployeeStates_StartDate] ON [dbo].[EmployeeStates]([StartDate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeStates]') AND name = 'EndDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeStates_EndDate' AND object_id = OBJECT_ID(N'[dbo].[EmployeeStates]'))
        CREATE NONCLUSTERED INDEX [IX_EmployeeStates_EndDate] ON [dbo].[EmployeeStates]([EndDate]);
END;

-- SpecialCases: EmployeesId, IsActive, CaseType
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX [IX_SpecialCases_EmployeesId] ON [dbo].[SpecialCases]([EmployeesId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'IsActive')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_IsActive' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX [IX_SpecialCases_IsActive] ON [dbo].[SpecialCases]([IsActive]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'CaseType' AND max_length <> -1)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_CaseType' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX [IX_SpecialCases_CaseType] ON [dbo].[SpecialCases]([CaseType]);
END;

-- SystemRecords: CreatedDate, UsersId
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SystemRecords]') AND name = 'CreatedDate')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_CreatedDate' AND object_id = OBJECT_ID(N'[dbo].[SystemRecords]'))
        CREATE NONCLUSTERED INDEX [IX_SystemRecords_CreatedDate] ON [dbo].[SystemRecords]([CreatedDate]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SystemRecords]') AND name = 'UsersId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SystemRecords_UsersId' AND object_id = OBJECT_ID(N'[dbo].[SystemRecords]'))
        CREATE NONCLUSTERED INDEX [IX_SystemRecords_UsersId] ON [dbo].[SystemRecords]([UsersId]);
END;

-- RankHistory, PositionHistory, EmployeeFiles FK indexes
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[RankHistory]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RankHistory_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[RankHistory]'))
        CREATE NONCLUSTERED INDEX [IX_RankHistory_EmployeesId] ON [dbo].[RankHistory]([EmployeesId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[PositionHistory]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PositionHistory_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[PositionHistory]'))
        CREATE NONCLUSTERED INDEX [IX_PositionHistory_EmployeesId] ON [dbo].[PositionHistory]([EmployeesId]);
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeFiles_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]'))
        CREATE NONCLUSTERED INDEX [IX_EmployeeFiles_EmployeesId] ON [dbo].[EmployeeFiles]([EmployeesId]);
END;
