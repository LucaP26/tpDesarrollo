IF COL_LENGTH('app_users', 'document_front_image_url') IS NOT NULL
BEGIN
    ALTER TABLE dbo.app_users
    ALTER COLUMN document_front_image_url NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('app_users', 'document_back_image_url') IS NOT NULL
BEGIN
    ALTER TABLE dbo.app_users
    ALTER COLUMN document_back_image_url NVARCHAR(MAX) NULL;
END;
GO
