IF COL_LENGTH('dbo.app_users', 'birth_date') IS NULL
BEGIN
    ALTER TABLE dbo.app_users
    ADD birth_date VARCHAR(10) NULL;
END
GO

IF COL_LENGTH('dbo.app_users', 'birth_date') IS NOT NULL
AND EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'app_users'
      AND COLUMN_NAME = 'birth_date'
      AND DATA_TYPE <> 'varchar'
)
BEGIN
    ALTER TABLE dbo.app_users
    ALTER COLUMN birth_date VARCHAR(10) NULL;
END
GO
