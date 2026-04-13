/*
  Completa cada sala curada con un tercer lote real para que el catalogo
  muestre tres piezas por categoria.
*/

UPDATE dbo.app_auctions
SET auctioneer_name = 'Clara Benitez'
WHERE id = 5001 AND (auctioneer_name IS NULL OR LTRIM(RTRIM(auctioneer_name)) = '');
GO

UPDATE dbo.app_auctions
SET auctioneer_name = 'Julian Casas'
WHERE id = 5002 AND (auctioneer_name IS NULL OR LTRIM(RTRIM(auctioneer_name)) = '');
GO

UPDATE dbo.app_auctions
SET auctioneer_name = 'Isabel Ferrer'
WHERE id = 5003 AND (auctioneer_name IS NULL OR LTRIM(RTRIM(auctioneer_name)) = '');
GO

UPDATE dbo.app_auctions
SET auctioneer_name = 'Martin Echeverria'
WHERE id = 5004 AND (auctioneer_name IS NULL OR LTRIM(RTRIM(auctioneer_name)) = '');
GO

UPDATE dbo.app_auctions
SET auctioneer_name = 'Sofia Balmaceda'
WHERE id = 5005 AND (auctioneer_name IS NULL OR LTRIM(RTRIM(auctioneer_name)) = '');
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5103)
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
        5103,
        5001,
        103,
        1003,
        'C-103',
        'Tocadiscos Thorens TD 160',
        'Tocadiscos suizo con brazo original, tapa acrilica y puesta a punto reciente.',
        'Una pieza accesible y muy buscada dentro del coleccionismo de audio de alta fidelidad.',
        'Thorens',
        3900000.00,
        0.10,
        -1,
        '["https://placehold.co/1200x900/EAE4DC/181818?text=Thorens+TD+160"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5203)
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
        5203,
        5002,
        203,
        2003,
        'E-203',
        'Montblanc Writers Edition Cervantes',
        'Estilografica de resina preciosa con plumín de oro y estuche completo.',
        'Objeto de escritorio firmado que combina liquidez, marca fuerte y atractivo de vitrina.',
        'Montblanc',
        18500.00,
        0.12,
        -1,
        '["https://placehold.co/1200x900/F1ECE4/181818?text=Montblanc+Cervantes"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5303)
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
        5303,
        5003,
        303,
        3003,
        'P-303',
        'Mesa Charlotte Perriand Les Arcs',
        'Mesa de roble y metal atribuida a la serie Les Arcs con pátina de época.',
        'Diseño historico europeo con procedencia atractiva para una categoria intermedia alta.',
        'Charlotte Perriand',
        142000.00,
        0.14,
        -1,
        '["https://placehold.co/1200x900/EBE5DB/181818?text=Charlotte+Perriand"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5403)
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
        5403,
        5004,
        403,
        4003,
        'O-403',
        'Rolex Day-Date 40 Everose',
        'Reloj de oro Everose con brazalete President y juego completo de caja y papeles.',
        'Referencia de acceso premium para una sala donde la joyeria y la relojeria ya rozan el segmento patrimonial.',
        'Rolex',
        710000.00,
        0.15,
        -1,
        '["https://placehold.co/1200x900/EDE4D8/181818?text=Rolex+Day-Date+40"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_lots WHERE id = 5503)
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
        5503,
        5005,
        503,
        5003,
        'PL-503',
        'Hermes Birkin Himalaya 30',
        'Bolso de cocodrilo Niloticus con herrajes en oro blanco y certificado internacional.',
        'Uno de los objetos mas codiciados del lujo contemporaneo, pensado para una sala platino.',
        'Hermes',
        2650000.00,
        0.18,
        -1,
        '["https://placehold.co/1200x900/F2EBE0/181818?text=Hermes+Birkin+Himalaya"]',
        NULL,
        NULL,
        0,
        0
    );
END;
GO
