IF COL_LENGTH('app_users', 'gender') IS NULL
BEGIN
    ALTER TABLE dbo.app_users
    ADD gender VARCHAR(20) NULL;
END;
GO

UPDATE dbo.app_users
SET gender = 'otro'
WHERE gender IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'app_users'
      AND COLUMN_NAME = 'gender'
      AND IS_NULLABLE = 'YES'
)
BEGIN
    ALTER TABLE dbo.app_users
    ALTER COLUMN gender VARCHAR(20) NOT NULL;
END;
GO
