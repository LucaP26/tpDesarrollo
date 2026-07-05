/*
  Moves duplicated app_* runtime rows into the original legacy tables plus small
  metadata tables for fields that the OG schema cannot represent.

  After this migration, these duplicate app tables are intentionally left empty:
  app_users, app_auctions, app_lots, app_bids, app_purchases, app_attendance.
*/

IF OBJECT_ID('dbo.app_legacy_user_metadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_legacy_user_metadata (
        user_id INT NOT NULL,
        email VARCHAR(250) NOT NULL,
        first_name VARCHAR(150) NULL,
        last_name VARCHAR(150) NULL,
        gender VARCHAR(20) NOT NULL DEFAULT 'otro',
        birth_date VARCHAR(10) NULL,
        registration_stage VARCHAR(40) NOT NULL DEFAULT 'registro_completado',
        roles_json NVARCHAR(MAX) NOT NULL,
        password_hash VARCHAR(500) NULL,
        document_front_image_url NVARCHAR(MAX) NULL,
        document_back_image_url NVARCHAR(MAX) NULL,
        avatar_image_url NVARCHAR(MAX) NULL,
        CONSTRAINT pk_app_legacy_user_metadata PRIMARY KEY (user_id),
        CONSTRAINT uq_app_legacy_user_metadata_email UNIQUE (email)
    );
END;
GO

IF OBJECT_ID('dbo.app_legacy_auction_metadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_legacy_auction_metadata (
        auction_id INT NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
        state VARCHAR(20) NOT NULL DEFAULT 'abierta',
        CONSTRAINT pk_app_legacy_auction_metadata PRIMARY KEY (auction_id)
    );
END;
GO

IF OBJECT_ID('dbo.app_legacy_lot_metadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_legacy_lot_metadata (
        lot_id INT NOT NULL,
        catalog_item_id INT NOT NULL,
        piece_number VARCHAR(50) NOT NULL,
        title VARCHAR(250) NOT NULL,
        story NVARCHAR(MAX) NULL,
        artist VARCHAR(250) NULL,
        image_urls_json NVARCHAR(MAX) NOT NULL,
        current_bidder_id INT NULL,
        bidding_started_at DATETIME NULL,
        bid_deadline_at DATETIME NULL,
        sold_to_company BIT NOT NULL DEFAULT 0,
        CONSTRAINT pk_app_legacy_lot_metadata PRIMARY KEY (lot_id),
        CONSTRAINT uq_app_legacy_lot_metadata_catalog_item UNIQUE (catalog_item_id)
    );
END;
GO

IF OBJECT_ID('dbo.app_legacy_bid_metadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_legacy_bid_metadata (
        bid_id INT NOT NULL,
        auction_id INT NOT NULL,
        lot_id INT NOT NULL,
        status VARCHAR(30) NOT NULL,
        created_at DATETIME2 NOT NULL,
        payment_method_id INT NULL,
        CONSTRAINT pk_app_legacy_bid_metadata PRIMARY KEY (bid_id)
    );
END;
GO

IF OBJECT_ID('dbo.app_legacy_purchase_metadata', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_legacy_purchase_metadata (
        purchase_id INT NOT NULL,
        lot_id INT NOT NULL,
        shipping_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
        payment_method_id INT NULL,
        paid BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT pk_app_legacy_purchase_metadata PRIMARY KEY (purchase_id)
    );
END;
GO

IF OBJECT_ID('dbo.syncLegacyFromAppRuntime', 'P') IS NOT NULL
BEGIN
    EXEC dbo.syncLegacyFromAppRuntime;
END;
GO

IF OBJECT_ID('dbo.app_users', 'U') IS NOT NULL
AND EXISTS (SELECT 1 FROM dbo.app_users)
BEGIN
    MERGE dbo.app_legacy_user_metadata AS target
    USING (
        SELECT
            id,
            email,
            first_name,
            last_name,
            gender,
            birth_date,
            registration_stage,
            roles_json,
            password_hash,
            document_front_image_url,
            document_back_image_url,
            avatar_image_url
        FROM dbo.app_users
    ) AS source
    ON target.user_id = source.id
    WHEN MATCHED THEN
        UPDATE SET
            email = source.email,
            first_name = source.first_name,
            last_name = source.last_name,
            gender = source.gender,
            birth_date = source.birth_date,
            registration_stage = source.registration_stage,
            roles_json = source.roles_json,
            password_hash = source.password_hash,
            document_front_image_url = source.document_front_image_url,
            document_back_image_url = source.document_back_image_url,
            avatar_image_url = source.avatar_image_url
    WHEN NOT MATCHED THEN
        INSERT (
            user_id,
            email,
            first_name,
            last_name,
            gender,
            birth_date,
            registration_stage,
            roles_json,
            password_hash,
            document_front_image_url,
            document_back_image_url,
            avatar_image_url
        )
        VALUES (
            source.id,
            source.email,
            source.first_name,
            source.last_name,
            source.gender,
            source.birth_date,
            source.registration_stage,
            source.roles_json,
            source.password_hash,
            source.document_front_image_url,
            source.document_back_image_url,
            source.avatar_image_url
        );
END;
GO

IF OBJECT_ID('dbo.app_auctions', 'U') IS NOT NULL
AND EXISTS (SELECT 1 FROM dbo.app_auctions)
BEGIN
    MERGE dbo.app_legacy_auction_metadata AS target
    USING (
        SELECT id, currency, state
        FROM dbo.app_auctions
    ) AS source
    ON target.auction_id = source.id
    WHEN MATCHED THEN
        UPDATE SET
            currency = source.currency,
            state = source.state
    WHEN NOT MATCHED THEN
        INSERT (auction_id, currency, state)
        VALUES (source.id, source.currency, source.state);
END;
GO

IF OBJECT_ID('dbo.app_lots', 'U') IS NOT NULL
AND EXISTS (SELECT 1 FROM dbo.app_lots)
BEGIN
    MERGE dbo.app_legacy_lot_metadata AS target
    USING (
        SELECT
            id,
            catalog_item_id,
            piece_number,
            title,
            story,
            artist,
            image_urls_json,
            current_bidder_id,
            bidding_started_at,
            bid_deadline_at,
            sold_to_company
        FROM dbo.app_lots
    ) AS source
    ON target.lot_id = source.id
    WHEN MATCHED THEN
        UPDATE SET
            catalog_item_id = source.catalog_item_id,
            piece_number = source.piece_number,
            title = source.title,
            story = source.story,
            artist = source.artist,
            image_urls_json = source.image_urls_json,
            current_bidder_id = source.current_bidder_id,
            bidding_started_at = source.bidding_started_at,
            bid_deadline_at = source.bid_deadline_at,
            sold_to_company = source.sold_to_company
    WHEN NOT MATCHED THEN
        INSERT (
            lot_id,
            catalog_item_id,
            piece_number,
            title,
            story,
            artist,
            image_urls_json,
            current_bidder_id,
            bidding_started_at,
            bid_deadline_at,
            sold_to_company
        )
        VALUES (
            source.id,
            source.catalog_item_id,
            source.piece_number,
            source.title,
            source.story,
            source.artist,
            source.image_urls_json,
            source.current_bidder_id,
            source.bidding_started_at,
            source.bid_deadline_at,
            source.sold_to_company
        );
END;
GO

IF OBJECT_ID('dbo.app_bids', 'U') IS NOT NULL
AND EXISTS (SELECT 1 FROM dbo.app_bids)
BEGIN
    MERGE dbo.app_legacy_bid_metadata AS target
    USING (
        SELECT id, auction_id, lot_id, status, created_at, payment_method_id
        FROM dbo.app_bids
    ) AS source
    ON target.bid_id = source.id
    WHEN MATCHED THEN
        UPDATE SET
            auction_id = source.auction_id,
            lot_id = source.lot_id,
            status = source.status,
            created_at = source.created_at,
            payment_method_id = source.payment_method_id
    WHEN NOT MATCHED THEN
        INSERT (bid_id, auction_id, lot_id, status, created_at, payment_method_id)
        VALUES (source.id, source.auction_id, source.lot_id, source.status, source.created_at, source.payment_method_id);
END;
GO

IF OBJECT_ID('dbo.app_purchases', 'U') IS NOT NULL
AND EXISTS (SELECT 1 FROM dbo.app_purchases)
BEGIN
    MERGE dbo.app_legacy_purchase_metadata AS target
    USING (
        SELECT
            id,
            lot_id,
            shipping_amount,
            total_amount,
            currency,
            payment_method_id,
            paid,
            created_at
        FROM dbo.app_purchases
    ) AS source
    ON target.purchase_id = source.id
    WHEN MATCHED THEN
        UPDATE SET
            lot_id = source.lot_id,
            shipping_amount = source.shipping_amount,
            total_amount = source.total_amount,
            currency = source.currency,
            payment_method_id = source.payment_method_id,
            paid = source.paid,
            created_at = source.created_at
    WHEN NOT MATCHED THEN
        INSERT (
            purchase_id,
            lot_id,
            shipping_amount,
            total_amount,
            currency,
            payment_method_id,
            paid,
            created_at
        )
        VALUES (
            source.id,
            source.lot_id,
            source.shipping_amount,
            source.total_amount,
            source.currency,
            source.payment_method_id,
            source.paid,
            source.created_at
        );
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_payment_methods_users')
BEGIN
    ALTER TABLE dbo.app_payment_methods DROP CONSTRAINT fk_app_payment_methods_users;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_notifications_users')
BEGIN
    ALTER TABLE dbo.app_notifications DROP CONSTRAINT fk_app_notifications_users;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_penalties_users')
BEGIN
    ALTER TABLE dbo.app_penalties DROP CONSTRAINT fk_app_penalties_users;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_password_reset_tokens_users')
BEGIN
    ALTER TABLE dbo.app_password_reset_tokens DROP CONSTRAINT fk_app_password_reset_tokens_users;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_watchlist_user')
BEGIN
    ALTER TABLE dbo.app_watchlist DROP CONSTRAINT fk_app_watchlist_user;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_watchlist_auction')
BEGIN
    ALTER TABLE dbo.app_watchlist DROP CONSTRAINT fk_app_watchlist_auction;
END;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_app_consignments_users')
BEGIN
    ALTER TABLE dbo.app_consignments DROP CONSTRAINT fk_app_consignments_users;
END;
GO

IF OBJECT_ID('dbo.app_attendance', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_attendance;
END;
GO

IF OBJECT_ID('dbo.app_purchases', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_purchases;
END;
GO

IF OBJECT_ID('dbo.app_bids', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_bids;
END;
GO

IF OBJECT_ID('dbo.app_lots', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_lots;
END;
GO

IF OBJECT_ID('dbo.app_auctions', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_auctions;
END;
GO

IF OBJECT_ID('dbo.app_users', 'U') IS NOT NULL
BEGIN
    DELETE FROM dbo.app_users;
END;
GO

IF OBJECT_ID('dbo.syncLegacyFromAppRuntime', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.syncLegacyFromAppRuntime;
END;
GO
