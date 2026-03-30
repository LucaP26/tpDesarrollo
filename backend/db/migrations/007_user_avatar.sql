IF COL_LENGTH('app_users', 'avatar_image_url') IS NULL
BEGIN
    ALTER TABLE app_users
    ADD avatar_image_url NVARCHAR(MAX) NULL;
END
GO
