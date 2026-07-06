/*
  Metadata for purchase/shipping coordination conversations.
  These threads keep the buyer as owner_user_id and point to the seller.
*/

IF COL_LENGTH('dbo.app_message_threads', 'purchase_id') IS NULL
BEGIN
    ALTER TABLE dbo.app_message_threads
    ADD purchase_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.app_message_threads', 'seller_user_id') IS NULL
BEGIN
    ALTER TABLE dbo.app_message_threads
    ADD seller_user_id INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'ix_app_message_threads_purchase'
      AND object_id = OBJECT_ID('dbo.app_message_threads')
)
BEGIN
    CREATE INDEX ix_app_message_threads_purchase
    ON dbo.app_message_threads (purchase_id, owner_user_id);
END;
GO
