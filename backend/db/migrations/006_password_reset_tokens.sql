IF OBJECT_ID('dbo.app_password_reset_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_password_reset_tokens (
        id INT NOT NULL,
        user_id INT NOT NULL,
        token_hash VARCHAR(128) NOT NULL,
        created_at DATETIME2 NOT NULL,
        expires_at DATETIME2 NOT NULL,
        used_at DATETIME2 NULL,
        CONSTRAINT pk_app_password_reset_tokens PRIMARY KEY (id),
        CONSTRAINT fk_app_password_reset_tokens_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id)
    );
END;
GO
