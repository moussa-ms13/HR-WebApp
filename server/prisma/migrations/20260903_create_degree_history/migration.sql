-- ============================================================
-- Migration: Create DegreeHistory table
-- Tracks degree progression (الدرجة 0-12) per employee
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DegreeHistory]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[DegreeHistory] (
        [Id]                INT             IDENTITY(1,1) NOT NULL,
        [EmployeesId]       INT             NOT NULL,
        [DegreeLevel]       INT             NOT NULL,
        [PromotionDuration] NVARCHAR(50)    NOT NULL,
        [EffectiveDate]     DATETIME2       NOT NULL,
        [ReferenceDoc]      NVARCHAR(MAX)   NOT NULL,
        [Notes]             NVARCHAR(MAX)   NULL,
        CONSTRAINT [PK_DegreeHistory] PRIMARY KEY CLUSTERED ([Id] ASC),
        CONSTRAINT [FK_DegreeHistory_Employees_EmployeesId] FOREIGN KEY ([EmployeesId])
            REFERENCES [dbo].[Employees]([Id]) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_DegreeHistory_EmployeesId] ON [dbo].[DegreeHistory]([EmployeesId]);
    CREATE NONCLUSTERED INDEX [IX_DegreeHistory_EffectiveDate] ON [dbo].[DegreeHistory]([EffectiveDate]);
END;
