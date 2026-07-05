/*
  Correspondencia operativa entre usuarios y la empresa.
  El esquema legado no trae tablas de mensajes, por eso vive como dato app-only.
*/

IF OBJECT_ID('dbo.app_message_threads', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_message_threads (
        id INT NOT NULL,
        owner_user_id INT NOT NULL,
        consignment_id INT NULL,
        subject VARCHAR(250) NOT NULL,
        status VARCHAR(30) NOT NULL,
        created_at DATETIME2 NOT NULL,
        updated_at DATETIME2 NOT NULL,
        CONSTRAINT pk_app_message_threads PRIMARY KEY (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_messages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_messages (
        id INT NOT NULL,
        thread_id INT NOT NULL,
        sender_type VARCHAR(30) NOT NULL,
        sender_user_id INT NULL,
        body NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT pk_app_messages PRIMARY KEY (id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ix_app_message_threads_owner'
      AND object_id = OBJECT_ID('dbo.app_message_threads')
)
BEGIN
    CREATE INDEX ix_app_message_threads_owner
    ON dbo.app_message_threads (owner_user_id, updated_at);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ix_app_messages_thread'
      AND object_id = OBJECT_ID('dbo.app_messages')
)
BEGIN
    CREATE INDEX ix_app_messages_thread
    ON dbo.app_messages (thread_id, created_at);
END;
GO
