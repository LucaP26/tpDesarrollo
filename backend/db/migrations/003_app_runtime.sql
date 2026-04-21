/*
  Tablas operativas de la app.
  Persisten el estado que hoy usa el backend para login, pujas,
  notificaciones, consignaciones y metricas, sin alterar el esquema legado.
*/

IF OBJECT_ID('dbo.app_users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_users (
        id INT NOT NULL,
        email VARCHAR(250) NOT NULL,
        document_number VARCHAR(20) NOT NULL,
        first_name VARCHAR(150) NOT NULL,
        last_name VARCHAR(150) NOT NULL,
        gender VARCHAR(20) NOT NULL,
        legal_address VARCHAR(350) NOT NULL,
        country_code INT NOT NULL,
        category VARCHAR(20) NOT NULL,
        approved BIT NOT NULL,
        registration_stage VARCHAR(40) NOT NULL,
        roles_json NVARCHAR(MAX) NOT NULL,
        password_hash VARCHAR(500) NULL,
        document_front_image_url NVARCHAR(MAX) NULL,
        document_back_image_url NVARCHAR(MAX) NULL,
        CONSTRAINT pk_app_users PRIMARY KEY (id),
        CONSTRAINT uq_app_users_email UNIQUE (email)
    );
END;
GO

IF OBJECT_ID('dbo.app_payment_methods', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_payment_methods (
        id INT NOT NULL,
        user_id INT NOT NULL,
        type VARCHAR(40) NOT NULL,
        display_name VARCHAR(250) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        issuer_country VARCHAR(10) NOT NULL,
        available_amount DECIMAL(18, 2) NOT NULL,
        status VARCHAR(30) NOT NULL,
        last_four VARCHAR(10) NULL,
        verified_at DATETIME2 NULL,
        CONSTRAINT pk_app_payment_methods PRIMARY KEY (id),
        CONSTRAINT fk_app_payment_methods_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_auctions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_auctions (
        id INT NOT NULL,
        title VARCHAR(250) NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        category VARCHAR(20) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        state VARCHAR(20) NOT NULL,
        auctioneer_name VARCHAR(250) NOT NULL,
        location VARCHAR(350) NOT NULL,
        capacity INT NOT NULL,
        has_storage BIT NOT NULL,
        private_security BIT NOT NULL,
        CONSTRAINT pk_app_auctions PRIMARY KEY (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_lots', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_lots (
        id INT NOT NULL,
        auction_id INT NOT NULL,
        product_id INT NOT NULL,
        catalog_item_id INT NOT NULL,
        piece_number VARCHAR(50) NOT NULL,
        title VARCHAR(250) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        story NVARCHAR(MAX) NULL,
        artist VARCHAR(250) NULL,
        base_price DECIMAL(18, 2) NOT NULL,
        commission_rate DECIMAL(18, 4) NOT NULL,
        owner_user_id INT NOT NULL,
        image_urls_json NVARCHAR(MAX) NOT NULL,
        current_bid DECIMAL(18, 2) NULL,
        current_bidder_id INT NULL,
        sold BIT NOT NULL,
        sold_to_company BIT NOT NULL,
        CONSTRAINT pk_app_lots PRIMARY KEY (id),
        CONSTRAINT fk_app_lots_auctions FOREIGN KEY (auction_id) REFERENCES dbo.app_auctions (id),
        CONSTRAINT fk_app_lots_users FOREIGN KEY (owner_user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_bids', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_bids (
        id INT NOT NULL,
        auction_id INT NOT NULL,
        lot_id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        status VARCHAR(30) NOT NULL,
        created_at DATETIME2 NOT NULL,
        payment_method_id INT NULL,
        CONSTRAINT pk_app_bids PRIMARY KEY (id),
        CONSTRAINT fk_app_bids_auctions FOREIGN KEY (auction_id) REFERENCES dbo.app_auctions (id),
        CONSTRAINT fk_app_bids_lots FOREIGN KEY (lot_id) REFERENCES dbo.app_lots (id),
        CONSTRAINT fk_app_bids_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_notifications (
        id INT NOT NULL,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        kind VARCHAR(30) NOT NULL,
        created_at DATETIME2 NOT NULL,
        [read] BIT NOT NULL,
        CONSTRAINT pk_app_notifications PRIMARY KEY (id),
        CONSTRAINT fk_app_notifications_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_consignments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_consignments (
        id INT NOT NULL,
        owner_user_id INT NOT NULL,
        title VARCHAR(250) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        story NVARCHAR(MAX) NULL,
        photos_json NVARCHAR(MAX) NOT NULL,
        declared_ownership BIT NOT NULL,
        declared_legal_origin BIT NOT NULL,
        status VARCHAR(30) NOT NULL,
        created_at DATETIME2 NOT NULL,
        rejection_reason NVARCHAR(MAX) NULL,
        proposed_base_price DECIMAL(18, 2) NULL,
        commission_rate DECIMAL(18, 4) NULL,
        assigned_auction_id INT NULL,
        storage_location VARCHAR(250) NULL,
        insurance_policy VARCHAR(100) NULL,
        CONSTRAINT pk_app_consignments PRIMARY KEY (id),
        CONSTRAINT fk_app_consignments_users FOREIGN KEY (owner_user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_purchases', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_purchases (
        id INT NOT NULL,
        auction_id INT NOT NULL,
        lot_id INT NOT NULL,
        buyer_user_id INT NOT NULL,
        owner_user_id INT NOT NULL,
        hammer_price DECIMAL(18, 2) NOT NULL,
        commission_amount DECIMAL(18, 2) NOT NULL,
        shipping_amount DECIMAL(18, 2) NOT NULL,
        total_amount DECIMAL(18, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        payment_method_id INT NULL,
        paid BIT NOT NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT pk_app_purchases PRIMARY KEY (id),
        CONSTRAINT fk_app_purchases_auctions FOREIGN KEY (auction_id) REFERENCES dbo.app_auctions (id),
        CONSTRAINT fk_app_purchases_lots FOREIGN KEY (lot_id) REFERENCES dbo.app_lots (id),
        CONSTRAINT fk_app_purchases_buyers FOREIGN KEY (buyer_user_id) REFERENCES dbo.app_users (id),
        CONSTRAINT fk_app_purchases_owners FOREIGN KEY (owner_user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_penalties', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_penalties (
        id INT NOT NULL,
        user_id INT NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        status VARCHAR(30) NOT NULL,
        due_at DATETIME2 NOT NULL,
        reason NVARCHAR(MAX) NOT NULL,
        CONSTRAINT pk_app_penalties PRIMARY KEY (id),
        CONSTRAINT fk_app_penalties_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id)
    );
END;
GO

IF OBJECT_ID('dbo.app_attendance', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_attendance (
        id INT NOT NULL,
        user_id INT NOT NULL,
        auction_id INT NOT NULL,
        CONSTRAINT pk_app_attendance PRIMARY KEY (id),
        CONSTRAINT fk_app_attendance_users FOREIGN KEY (user_id) REFERENCES dbo.app_users (id),
        CONSTRAINT fk_app_attendance_auctions FOREIGN KEY (auction_id) REFERENCES dbo.app_auctions (id),
        CONSTRAINT uq_app_attendance UNIQUE (user_id, auction_id)
    );
END;
GO
