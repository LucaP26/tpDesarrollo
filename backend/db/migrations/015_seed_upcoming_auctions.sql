/*
  Agrega tres subastas programadas para Discover.
  Son catalogos reales en DB, visibles por jerarquia de categoria,
  pero no habilitan pujas ni precio base hasta pasar a estado abierta.
*/

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 6001)
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
        6001,
        'Proxima Sala Comun | Objetos cotidianos de autor',
        '2026-06-18',
        '19:00:00',
        'comun',
        'ARS',
        'programada',
        'Clara Benitez',
        'Buenos Aires - Galeria Norte',
        160,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6101)
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
        6101,
        6001,
        6101,
        61001,
        'PC-101',
        'Radio Brionvega TS 502',
        'Radio portatil italiana de los anos sesenta, restaurada y con carcasa color crema.',
        'Objeto de diseno accesible, ideal para nuevos coleccionistas de piezas industriales.',
        'Brionvega',
        1650000.00,
        0.10,
        -1,
        '["drawable://lot_thorens_td160"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6102)
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
        6102,
        6001,
        6102,
        61002,
        'PC-102',
        'Sillon escandinavo de lectura',
        'Sillon bajo en madera clara y tapizado de lana, con lineas nordicas de mediados de siglo.',
        'Una pieza decorativa calida para una sala comun con foco en diseno domestico.',
        'Taller nordico',
        2100000.00,
        0.10,
        -1,
        '["drawable://lot_chesterfield"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6103)
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
        6103,
        6001,
        6103,
        61003,
        'PC-103',
        'Camara Nikon F2 Photomic',
        'Camara mecanica japonesa con lente 50mm, fotometro y estuche de cuero original.',
        'Clasico analogico confiable, pensado para atraer a coleccionistas jovenes.',
        'Nikon',
        2800000.00,
        0.10,
        -1,
        '["drawable://lot_leica_m6"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 6002)
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
        6002,
        'Proxima Sala Plata | Moderno y coleccionismo selecto',
        '2026-07-02',
        '20:30:00',
        'plata',
        'USD',
        'programada',
        'Isabel Ferrer',
        'Puerto Madero - Sala Atelier',
        90,
        1,
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6201)
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
        6201,
        6002,
        6201,
        62001,
        'PP-201',
        'Lampara Arteluce Triennale',
        'Lampara italiana de tres brazos con estructura negra y pantallas orientables.',
        'Icono de iluminacion moderna con fuerte presencia escenografica.',
        'Arteluce',
        72000.00,
        0.14,
        -1,
        '["drawable://lot_bronce_vertical"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6202)
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
        6202,
        6002,
        6202,
        62002,
        'PP-202',
        'Collage cinetico 1968',
        'Obra geometrica sobre papel con marco de museo y certificado de procedencia.',
        'Pieza moderna de escala mediana, elegida para una sala de categoria plata.',
        'Escuela rioplatense',
        98000.00,
        0.14,
        -1,
        '["drawable://lot_litografia"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6203)
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
        6203,
        6002,
        6203,
        62003,
        'PP-203',
        'Cartier Santos Galbee',
        'Reloj automatico de acero y oro con brazalete integrado y documentacion de servicio.',
        'Un watch de coleccion transversal, elegante sin llegar al segmento oro.',
        'Cartier',
        118000.00,
        0.14,
        -1,
        '["drawable://lot_cartier_tank"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_auctions WHERE id = 6003)
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
        6003,
        'Proxima Sala Platino | Iconos privados',
        '2026-08-20',
        '21:30:00',
        'platino',
        'USD',
        'programada',
        'Sofia Balmaceda',
        'Buenos Aires - Private Collection Room',
        35,
        1,
        1
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6301)
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
        6301,
        6003,
        6301,
        63001,
        'PPL-301',
        'Patek Philippe Nautilus 5711',
        'Reloj de acero con esfera azul, set completo y procedencia privada documentada.',
        'Uno de los watches contemporaneos mas buscados dentro de una sala platino.',
        'Patek Philippe',
        1950000.00,
        0.18,
        -1,
        '["drawable://lot_patek_3940"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6302)
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
        6302,
        6003,
        6302,
        63002,
        'PPL-302',
        'Ferrari 365 GTB/4 Daytona',
        'Gran turismo italiano con matching numbers y dossier de restauracion completo.',
        'Automovil de coleccion reservado para clientes platino por valor y logistica.',
        'Ferrari',
        7800000.00,
        0.18,
        -1,
        '["drawable://lot_ferrari_275"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 6303)
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
        6303,
        6003,
        6303,
        63003,
        'PPL-303',
        'Hermes Kelly Himalaya',
        'Bolso exotico con herrajes en paladio, certificado y conservacion de archivo.',
        'Pieza de lujo extremo, pensada para una sala de acceso platino.',
        'Hermes',
        2450000.00,
        0.18,
        -1,
        '["drawable://lot_birkin_himalaya"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO
