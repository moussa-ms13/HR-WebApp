-- ============================================================
-- Migration: Add Non-Clustered Indexes on Foreign Keys referencing Employees
-- Resolves severe latency in Employee Profile fetch & sub-tab queries
-- ============================================================

-- 1. Index on RankHistory (EmployeesId / EmployeeId)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[RankHistory]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RankHistory_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[RankHistory]'))
        CREATE NONCLUSTERED INDEX IX_RankHistory_EmployeesId ON [dbo].[RankHistory]([EmployeesId]);
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[RankHistory]') AND name = 'EmployeeId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RankHistory_EmployeeId' AND object_id = OBJECT_ID(N'[dbo].[RankHistory]'))
        CREATE NONCLUSTERED INDEX IX_RankHistory_EmployeeId ON [dbo].[RankHistory]([EmployeeId]);
END;

-- 2. Index on PositionHistory (EmployeesId / EmployeeId)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[PositionHistory]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PositionHistory_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[PositionHistory]'))
        CREATE NONCLUSTERED INDEX IX_PositionHistory_EmployeesId ON [dbo].[PositionHistory]([EmployeesId]);
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[PositionHistory]') AND name = 'EmployeeId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PositionHistory_EmployeeId' AND object_id = OBJECT_ID(N'[dbo].[PositionHistory]'))
        CREATE NONCLUSTERED INDEX IX_PositionHistory_EmployeeId ON [dbo].[PositionHistory]([EmployeeId]);
END;

-- 3. Index on EmployeeStates (EmployeesId / EmployeeId)
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

-- 4. Index on EmployeeFiles (EmployeesId / EmployeeId)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeFiles_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeFiles_EmployeesId ON [dbo].[EmployeeFiles]([EmployeesId]);
END
ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]') AND name = 'EmployeeId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmployeeFiles_EmployeeId' AND object_id = OBJECT_ID(N'[dbo].[EmployeeFiles]'))
        CREATE NONCLUSTERED INDEX IX_EmployeeFiles_EmployeeId ON [dbo].[EmployeeFiles]([EmployeeId]);
END;

-- 5. Index on SpecialCases (EmployeesId / EmployeeId)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[SpecialCases]') AND name = 'EmployeesId')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SpecialCases_EmployeesId' AND object_id = OBJECT_ID(N'[dbo].[SpecialCases]'))
        CREATE NONCLUSTERED INDEX IX_SpecialCases_EmployeesId ON [dbo].[SpecialCases]([EmployeesId]);
END;
