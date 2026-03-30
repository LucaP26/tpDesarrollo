/*
  Seed inicial de subastas reales por categoria.
  No altera el esquema existente y se puede ejecutar multiples veces
  sin duplicar datos.
*/

IF NOT EXISTS (SELECT 1 FROM dbo.app_users WHERE id = -1)
BEGIN
    INSERT INTO dbo.app_users (
        id,
        email,
        document_number,
        first_name,
        last_name,
        legal_address,
        country_code,
        category,
        approved,
        registration_stage,
        roles_json,
        password_hash,
        document_front_image_url,
        document_back_image_url,
        avatar_image_url
    )
    VALUES (
        -1,
        'catalogo@eliteauctions.local',
        '99999999',
        'Casa',
        'Elite',
        'Av. del Libertador 4100, Buenos Aires',
        32,
        'platino',
        1,
        'registro_completado',
        '["duenio"]',
        NULL,
        NULL,
        NULL,
        NULL
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 5001)
BEGIN
    INSERT INTO dbo.app_auctions (
        id,
        title,
        scheduled_date,
        scheduled_time,
        category,
        currency,
        state,
        auctioneer_name,
        location,
        capacity,
        has_storage,
        private_security
    )
    VALUES (
        5001,
        'Sala Comun | Diseno y coleccion',
        '2026-03-24',
        '19:00:00',
        'comun',
        'ARS',
        'abierta',
        'Clara Benitez',
        'Buenos Aires - Casa Central',
        180,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 5002)
BEGIN
    INSERT INTO dbo.app_auctions (
        id,
        title,
        scheduled_date,
        scheduled_time,
        category,
        currency,
        state,
        auctioneer_name,
        location,
        capacity,
        has_storage,
        private_security
    )
    VALUES (
        5002,
        'Sala Especial | Relojes y obra firmada',
        '2026-03-25',
        '20:00:00',
        'especial',
        'USD',
        'abierta',
        'Julian Casas',
        'Buenos Aires - Salon Norte',
        120,
        1,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 5003)
BEGIN
    INSERT INTO dbo.app_auctions (
        id,
        title,
        scheduled_date,
        scheduled_time,
        category,
        currency,
        state,
        auctioneer_name,
        location,
        capacity,
        has_storage,
        private_security
    )
    VALUES (
        5003,
        'Sala Plata | Arte moderno y piezas de autor',
        '2026-03-26',
        '20:30:00',
        'plata',
        'USD',
        'abierta',
        'Isabel Ferrer',
        'Puerto Madero - Salon de Arte',
        90,
        1,
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 5004)
BEGIN
    INSERT INTO dbo.app_auctions (
        id,
        title,
        scheduled_date,
        scheduled_time,
        category,
        currency,
        state,
        auctioneer_name,
        location,
        capacity,
        has_storage,
        private_security
    )
    VALUES (
        5004,
        'Sala Oro | Alta joyeria y relojeria',
        '2026-03-27',
        '21:00:00',
        'oro',
        'USD',
        'abierta',
        'Martin Echeverria',
        'Buenos Aires - Private Vault',
        60,
        1,
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 5005)
BEGIN
    INSERT INTO dbo.app_auctions (
        id,
        title,
        scheduled_date,
        scheduled_time,
        category,
        currency,
        state,
        auctioneer_name,
        location,
        capacity,
        has_storage,
        private_security
    )
    VALUES (
        5005,
        'Sala Platino | Grandes iconos de coleccion',
        '2026-03-28',
        '21:30:00',
        'platino',
        'USD',
        'abierta',
        'Sofia Balmaceda',
        'Geneva Private Room',
        30,
        1,
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5101)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5101,
        5001,
        101,
        1001,
        'C-101',
        'Camara Leica M6 Classic',
        'Camara analogica alemana con lente Summicron y estuche original.',
        'Una pieza ideal para quienes comienzan una coleccion fotografica con una marca iconica.',
        'Leica',
        2800000.00,
        0.10,
        -1,
        '["https://placehold.co/1200x900/F2ECE2/181818?text=Leica+M6+Classic"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5102)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5102,
        5001,
        102,
        1002,
        'C-102',
        'Sillon Chesterfield Heritage',
        'Sillon tapizado en cuero marron con restauracion integral y terminacion a mano.',
        'Mueble de presencia clasica para una primera coleccion de interiorismo premium.',
        'Heritage House',
        4600000.00,
        0.10,
        -1,
        '["https://placehold.co/1200x900/E9DFD2/181818?text=Chesterfield+Heritage"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5201)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5201,
        5002,
        201,
        2001,
        'E-201',
        'Omega Seamaster 300 Co-Axial',
        'Reloj suizo de acero con calibre automatico, esfera negra y estuche completo.',
        'Un ingreso natural al segmento de relojeria de coleccion con liquidez internacional.',
        'Omega',
        14000.00,
        0.12,
        -1,
        '["https://placehold.co/1200x900/F4F2EE/181818?text=Omega+Seamaster+300"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5202)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5202,
        5002,
        202,
        2002,
        'E-202',
        'Litografia firmada "Ciudad en movimiento"',
        'Litografia numerada y firmada, enmarcada en roble claro con certificado de autenticidad.',
        'Obra de entrada para un coleccionista que ya busca firma reconocible y procedencia clara.',
        'Antonio Segui',
        22000.00,
        0.12,
        -1,
        '["https://placehold.co/1200x900/EDE6DA/181818?text=Litografia+Firmada"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5301)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5301,
        5003,
        301,
        3001,
        'P-301',
        'Escultura en bronce "Vertical"',
        'Escultura en bronce patinado sobre base de marmol con documentacion de taller.',
        'Pieza de sala pensada para un comprador que ya valora autor, tecnica y presencia museable.',
        'Alicia Penalba',
        65000.00,
        0.14,
        -1,
        '["https://placehold.co/1200x900/E7E1D8/181818?text=Escultura+en+Bronce"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5302)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5302,
        5003,
        302,
        3002,
        'P-302',
        'Cartier Tank Louis Vermeil',
        'Caja vermeil, esfera romana y correa de cocodrilo con servicio reciente.',
        'Modelo elegante y estable dentro del segmento de relojes de firma historica.',
        'Cartier',
        118000.00,
        0.14,
        -1,
        '["https://placehold.co/1200x900/F0ECE5/181818?text=Cartier+Tank+Louis"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5401)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5401,
        5004,
        401,
        4001,
        'O-401',
        'Collar Riviera en diamantes',
        'Collar articulado en oro blanco con diamantes calibrados y estuche de joyeria.',
        'Joyeria de alta gama para compradores con perfil patrimonial consolidado.',
        'Maison Riviera',
        380000.00,
        0.15,
        -1,
        '["https://placehold.co/1200x900/F3EEE8/181818?text=Collar+Riviera+Diamantes"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5402)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5402,
        5004,
        402,
        4002,
        'O-402',
        'Audemars Piguet Royal Oak Offshore',
        'Cronografo de gran caja con brazalete integrado y documentacion internacional.',
        'Una referencia emblematica dentro del coleccionismo contemporaneo de muy alto nivel.',
        'Audemars Piguet',
        620000.00,
        0.15,
        -1,
        '["https://placehold.co/1200x900/E8E3DB/181818?text=Royal+Oak+Offshore"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5501)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5501,
        5005,
        501,
        5001,
        'PL-501',
        'Patek Philippe Perpetual Calendar 3940',
        'Reloj de platino con calendario perpetuo, documentacion y procedencia privada verificable.',
        'Una pieza de coleccion internacional reservada para compradores del mas alto perfil.',
        'Patek Philippe',
        1850000.00,
        0.18,
        -1,
        '["https://placehold.co/1200x900/F1ECE3/181818?text=Patek+Philippe+3940"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5502)
BEGIN
    INSERT INTO dbo.app_lots (
        id,
        auction_id,
        product_id,
        catalog_item_id,
        piece_number,
        title,
        description,
        story,
        artist,
        base_price,
        commission_rate,
        owner_user_id,
        image_urls_json,
        current_bid,
        current_bidder_id,
        sold,
        sold_to_company
    )
    VALUES (
        5502,
        5005,
        502,
        5002,
        'PL-502',
        'Ferrari 275 GTB/4 Berlinetta 1967',
        'Automovil clasico certificado, matching numbers y dossier historico completo.',
        'Lote insignia para una subasta de maxima categoria con demanda global.',
        'Ferrari',
        9750000.00,
        0.18,
        -1,
        '["https://placehold.co/1200x900/EDE5D9/181818?text=Ferrari+275+GTB%2F4"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO
