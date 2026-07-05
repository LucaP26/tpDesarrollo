/*
  Projects the runtime app tables into the original legacy schema.

  This is intentionally non-destructive:
  - app_* tables remain the source for app-only data that the legacy schema cannot store.
  - existing legacy rows are updated/inserted by matching identifiers, but not deleted.
  - legacy tables with IDENTITY keys receive explicit app ids so relationships stay traceable.

  Lossy mappings:
  - app_auctions.state = 'programada' is projected as legacy 'abierta' because the
    legacy chkES constraint only allows 'abierta' and the typo 'carrada'.
  - app_lots image URLs are not copied into legacy fotos because fotos.foto is VARBINARY.
  - auth/session/watchlist/notifications/payment-method detail fields have no OG table.
*/

CREATE OR ALTER PROCEDURE dbo.syncLegacyFromAppRuntime
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @systemPersona INT = -900000;
    DECLARE @systemEmpleado INT = -900000;

    INSERT INTO dbo.paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
    SELECT DISTINCT
        u.country_code,
        CONCAT('Pais ', CONVERT(VARCHAR(20), u.country_code)),
        CONCAT('P', CONVERT(VARCHAR(20), u.country_code)),
        'Sin datos',
        'Sin datos',
        'Sin datos'
    FROM dbo.app_users u
    WHERE u.country_code IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.paises p
          WHERE p.numero = u.country_code
      );

    IF NOT EXISTS (SELECT 1 FROM dbo.empleados WHERE identificador = @systemEmpleado)
    BEGIN
        INSERT INTO dbo.empleados (identificador, cargo, sector)
        VALUES (@systemEmpleado, 'Sistema', NULL);
    END;

    SET IDENTITY_INSERT dbo.personas ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = @systemPersona)
    BEGIN
        INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
        VALUES (@systemPersona, 'SISTEMA', 'Sistema', NULL, 'activo', NULL);
    END;

    UPDATE p
    SET
        documento = LEFT(u.document_number, 20),
        nombre = LEFT(CONCAT(u.first_name, ' ', u.last_name), 150),
        direccion = LEFT(u.legal_address, 250),
        estado = CASE WHEN u.approved = 1 THEN 'activo' ELSE 'incativo' END
    FROM dbo.personas p
    INNER JOIN dbo.app_users u ON u.id = p.identificador;

    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    SELECT
        u.id,
        LEFT(u.document_number, 20),
        LEFT(CONCAT(u.first_name, ' ', u.last_name), 150),
        LEFT(u.legal_address, 250),
        CASE WHEN u.approved = 1 THEN 'activo' ELSE 'incativo' END,
        NULL
    FROM dbo.app_users u
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.personas p
        WHERE p.identificador = u.id
    );

    SET IDENTITY_INSERT dbo.personas OFF;

    ;WITH client_users AS (
        SELECT DISTINCT u.*
        FROM dbo.app_users u
        WHERE LOWER(u.roles_json) LIKE '%"cliente"%'
           OR EXISTS (SELECT 1 FROM dbo.app_attendance a WHERE a.user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_bids b WHERE b.user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_purchases p WHERE p.buyer_user_id = u.id)
    )
    UPDATE c
    SET
        numeroPais = u.country_code,
        admitido = CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        categoria = CASE
            WHEN u.category IN ('comun', 'especial', 'plata', 'oro', 'platino') THEN u.category
            ELSE 'comun'
        END,
        verificador = @systemEmpleado
    FROM dbo.clientes c
    INNER JOIN client_users u ON u.id = c.identificador;

    ;WITH client_users AS (
        SELECT DISTINCT u.*
        FROM dbo.app_users u
        WHERE LOWER(u.roles_json) LIKE '%"cliente"%'
           OR EXISTS (SELECT 1 FROM dbo.app_attendance a WHERE a.user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_bids b WHERE b.user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_purchases p WHERE p.buyer_user_id = u.id)
    )
    INSERT INTO dbo.clientes (identificador, numeroPais, admitido, categoria, verificador)
    SELECT
        u.id,
        u.country_code,
        CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        CASE
            WHEN u.category IN ('comun', 'especial', 'plata', 'oro', 'platino') THEN u.category
            ELSE 'comun'
        END,
        @systemEmpleado
    FROM client_users u
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.clientes c
        WHERE c.identificador = u.id
    );

    ;WITH owner_users AS (
        SELECT DISTINCT u.*
        FROM dbo.app_users u
        WHERE LOWER(u.roles_json) LIKE '%"duenio"%'
           OR EXISTS (SELECT 1 FROM dbo.app_lots l WHERE l.owner_user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_consignments c WHERE c.owner_user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_purchases p WHERE p.owner_user_id = u.id)
    )
    UPDATE d
    SET
        numeroPais = u.country_code,
        verificacionFinanciera = CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        verificacionJudicial = CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        calificacionRiesgo = CASE u.category
            WHEN 'platino' THEN 1
            WHEN 'oro' THEN 2
            WHEN 'plata' THEN 3
            WHEN 'especial' THEN 4
            ELSE 5
        END,
        verificador = @systemEmpleado
    FROM dbo.duenios d
    INNER JOIN owner_users u ON u.id = d.identificador;

    ;WITH owner_users AS (
        SELECT DISTINCT u.*
        FROM dbo.app_users u
        WHERE LOWER(u.roles_json) LIKE '%"duenio"%'
           OR EXISTS (SELECT 1 FROM dbo.app_lots l WHERE l.owner_user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_consignments c WHERE c.owner_user_id = u.id)
           OR EXISTS (SELECT 1 FROM dbo.app_purchases p WHERE p.owner_user_id = u.id)
    )
    INSERT INTO dbo.duenios (
        identificador,
        numeroPais,
        verificacionFinanciera,
        verificacionJudicial,
        calificacionRiesgo,
        verificador
    )
    SELECT
        u.id,
        u.country_code,
        CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        CASE WHEN u.approved = 1 THEN 'si' ELSE 'no' END,
        CASE u.category
            WHEN 'platino' THEN 1
            WHEN 'oro' THEN 2
            WHEN 'plata' THEN 3
            WHEN 'especial' THEN 4
            ELSE 5
        END,
        @systemEmpleado
    FROM owner_users u
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.duenios d
        WHERE d.identificador = u.id
    );

    ;WITH auctioneers AS (
        SELECT DISTINCT
            identificador = -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT),
            documento = CONCAT('SUBASTADOR-', CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) AS VARCHAR(20))),
            nombre = LEFT(a.auctioneer_name, 150)
        FROM dbo.app_auctions a
        WHERE a.auctioneer_name IS NOT NULL
          AND LTRIM(RTRIM(a.auctioneer_name)) <> ''
    )
    UPDATE p
    SET
        documento = LEFT(a.documento, 20),
        nombre = a.nombre,
        estado = 'activo'
    FROM dbo.personas p
    INNER JOIN auctioneers a ON a.identificador = p.identificador;

    SET IDENTITY_INSERT dbo.personas ON;

    ;WITH auctioneers AS (
        SELECT DISTINCT
            identificador = -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT),
            documento = CONCAT('SUBASTADOR-', CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) AS VARCHAR(20))),
            nombre = LEFT(a.auctioneer_name, 150)
        FROM dbo.app_auctions a
        WHERE a.auctioneer_name IS NOT NULL
          AND LTRIM(RTRIM(a.auctioneer_name)) <> ''
    )
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    SELECT
        a.identificador,
        LEFT(a.documento, 20),
        a.nombre,
        NULL,
        'activo',
        NULL
    FROM auctioneers a
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.personas p
        WHERE p.identificador = a.identificador
    );

    SET IDENTITY_INSERT dbo.personas OFF;

    ;WITH auctioneers AS (
        SELECT
            identificador = -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT),
            region = MIN(LEFT(a.location, 50))
        FROM dbo.app_auctions a
        WHERE a.auctioneer_name IS NOT NULL
          AND LTRIM(RTRIM(a.auctioneer_name)) <> ''
        GROUP BY -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT)
    )
    UPDATE s
    SET region = a.region
    FROM dbo.subastadores s
    INNER JOIN auctioneers a ON a.identificador = s.identificador;

    ;WITH auctioneers AS (
        SELECT
            identificador = -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT),
            matricula = CONCAT('AUTO-', CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS VARCHAR(20))),
            region = MIN(LEFT(a.location, 50))
        FROM dbo.app_auctions a
        WHERE a.auctioneer_name IS NOT NULL
          AND LTRIM(RTRIM(a.auctioneer_name)) <> ''
        GROUP BY
            -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT),
            CONCAT('AUTO-', CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS VARCHAR(20)))
    )
    INSERT INTO dbo.subastadores (identificador, matricula, region)
    SELECT a.identificador, LEFT(a.matricula, 15), a.region
    FROM auctioneers a
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.subastadores s
        WHERE s.identificador = a.identificador
    );

    ALTER TABLE dbo.subastas NOCHECK CONSTRAINT chkFecha;

    ;WITH auction_src AS (
        SELECT
            a.id,
            a.scheduled_date,
            a.scheduled_time,
            estado = CASE WHEN a.state = 'cerrada' THEN 'carrada' ELSE 'abierta' END,
            subastador = CASE
                WHEN a.auctioneer_name IS NULL OR LTRIM(RTRIM(a.auctioneer_name)) = '' THEN NULL
                ELSE -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT)
            END,
            ubicacion = LEFT(a.location, 350),
            a.capacity,
            tieneDeposito = CASE WHEN a.has_storage = 1 THEN 'si' ELSE 'no' END,
            seguridadPropia = CASE WHEN a.private_security = 1 THEN 'si' ELSE 'no' END,
            categoria = CASE
                WHEN a.category IN ('comun', 'especial', 'plata', 'oro', 'platino') THEN a.category
                ELSE 'comun'
            END
        FROM dbo.app_auctions a
    )
    UPDATE s
    SET
        fecha = a.scheduled_date,
        hora = a.scheduled_time,
        estado = a.estado,
        subastador = a.subastador,
        ubicacion = a.ubicacion,
        capacidadAsistentes = a.capacity,
        tieneDeposito = a.tieneDeposito,
        seguridadPropia = a.seguridadPropia,
        categoria = a.categoria
    FROM dbo.subastas s
    INNER JOIN auction_src a ON a.id = s.identificador;

    SET IDENTITY_INSERT dbo.subastas ON;

    ;WITH auction_src AS (
        SELECT
            a.id,
            a.scheduled_date,
            a.scheduled_time,
            estado = CASE WHEN a.state = 'cerrada' THEN 'carrada' ELSE 'abierta' END,
            subastador = CASE
                WHEN a.auctioneer_name IS NULL OR LTRIM(RTRIM(a.auctioneer_name)) = '' THEN NULL
                ELSE -1000000 - CAST(ABS(CONVERT(BIGINT, CHECKSUM(a.auctioneer_name))) % 100000000 AS INT)
            END,
            ubicacion = LEFT(a.location, 350),
            a.capacity,
            tieneDeposito = CASE WHEN a.has_storage = 1 THEN 'si' ELSE 'no' END,
            seguridadPropia = CASE WHEN a.private_security = 1 THEN 'si' ELSE 'no' END,
            categoria = CASE
                WHEN a.category IN ('comun', 'especial', 'plata', 'oro', 'platino') THEN a.category
                ELSE 'comun'
            END
        FROM dbo.app_auctions a
    )
    INSERT INTO dbo.subastas (
        identificador,
        fecha,
        hora,
        estado,
        subastador,
        ubicacion,
        capacidadAsistentes,
        tieneDeposito,
        seguridadPropia,
        categoria
    )
    SELECT
        a.id,
        a.scheduled_date,
        a.scheduled_time,
        a.estado,
        a.subastador,
        a.ubicacion,
        a.capacity,
        a.tieneDeposito,
        a.seguridadPropia,
        a.categoria
    FROM auction_src a
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.subastas s
        WHERE s.identificador = a.id
    );

    SET IDENTITY_INSERT dbo.subastas OFF;

    ALTER TABLE dbo.subastas CHECK CONSTRAINT chkFecha;

    UPDATE c
    SET
        descripcion = LEFT(a.title, 250),
        subasta = a.id,
        responsable = @systemEmpleado
    FROM dbo.catalogos c
    INNER JOIN dbo.app_auctions a ON a.id = c.identificador;

    SET IDENTITY_INSERT dbo.catalogos ON;

    INSERT INTO dbo.catalogos (identificador, descripcion, subasta, responsable)
    SELECT
        a.id,
        LEFT(a.title, 250),
        a.id,
        @systemEmpleado
    FROM dbo.app_auctions a
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.catalogos c
        WHERE c.identificador = a.id
    );

    SET IDENTITY_INSERT dbo.catalogos OFF;

    INSERT INTO dbo.seguros (nroPoliza, compania, polizaCombinada, importe)
    SELECT DISTINCT
        LEFT(c.insurance_policy, 30),
        'Sin datos',
        'no',
        0.01
    FROM dbo.app_consignments c
    WHERE c.insurance_policy IS NOT NULL
      AND LTRIM(RTRIM(c.insurance_policy)) <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.seguros s
          WHERE s.nroPoliza = LEFT(c.insurance_policy, 30)
      );

    UPDATE p
    SET
        fecha = a.scheduled_date,
        disponible = CASE WHEN l.sold = 1 THEN 'no' ELSE 'si' END,
        descripcionCatalogo = LEFT(CONCAT(l.title, ' - ', l.description), 500),
        descripcionCompleta = LEFT(COALESCE(NULLIF(l.description, ''), l.title, 'Sin descripcion'), 300),
        revisor = @systemEmpleado,
        duenio = l.owner_user_id,
        seguro = NULL
    FROM dbo.productos p
    INNER JOIN dbo.app_lots l ON l.product_id = p.identificador
    INNER JOIN dbo.app_auctions a ON a.id = l.auction_id;

    SET IDENTITY_INSERT dbo.productos ON;

    INSERT INTO dbo.productos (
        identificador,
        fecha,
        disponible,
        descripcionCatalogo,
        descripcionCompleta,
        revisor,
        duenio,
        seguro
    )
    SELECT
        l.product_id,
        a.scheduled_date,
        CASE WHEN l.sold = 1 THEN 'no' ELSE 'si' END,
        LEFT(CONCAT(l.title, ' - ', l.description), 500),
        LEFT(COALESCE(NULLIF(l.description, ''), l.title, 'Sin descripcion'), 300),
        @systemEmpleado,
        l.owner_user_id,
        NULL
    FROM dbo.app_lots l
    INNER JOIN dbo.app_auctions a ON a.id = l.auction_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.productos p
        WHERE p.identificador = l.product_id
    );

    ;WITH consignment_products AS (
        SELECT
            identificador = -300000000 - c.id,
            fecha = CAST(c.created_at AS DATE),
            disponible = CASE WHEN c.status IN ('aceptada', 'en_revision', 'enviada') THEN 'si' ELSE 'no' END,
            descripcionCatalogo = LEFT(CONCAT(c.title, ' - ', c.description), 500),
            descripcionCompleta = LEFT(COALESCE(NULLIF(c.description, ''), c.title, 'Sin descripcion'), 300),
            duenio = c.owner_user_id,
            seguro = LEFT(c.insurance_policy, 30)
        FROM dbo.app_consignments c
    )
    UPDATE p
    SET
        fecha = c.fecha,
        disponible = c.disponible,
        descripcionCatalogo = c.descripcionCatalogo,
        descripcionCompleta = c.descripcionCompleta,
        revisor = @systemEmpleado,
        duenio = c.duenio,
        seguro = c.seguro
    FROM dbo.productos p
    INNER JOIN consignment_products c ON c.identificador = p.identificador;

    ;WITH consignment_products AS (
        SELECT
            identificador = -300000000 - c.id,
            fecha = CAST(c.created_at AS DATE),
            disponible = CASE WHEN c.status IN ('aceptada', 'en_revision', 'enviada') THEN 'si' ELSE 'no' END,
            descripcionCatalogo = LEFT(CONCAT(c.title, ' - ', c.description), 500),
            descripcionCompleta = LEFT(COALESCE(NULLIF(c.description, ''), c.title, 'Sin descripcion'), 300),
            duenio = c.owner_user_id,
            seguro = LEFT(c.insurance_policy, 30)
        FROM dbo.app_consignments c
    )
    INSERT INTO dbo.productos (
        identificador,
        fecha,
        disponible,
        descripcionCatalogo,
        descripcionCompleta,
        revisor,
        duenio,
        seguro
    )
    SELECT
        c.identificador,
        c.fecha,
        c.disponible,
        c.descripcionCatalogo,
        c.descripcionCompleta,
        @systemEmpleado,
        c.duenio,
        c.seguro
    FROM consignment_products c
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.productos p
        WHERE p.identificador = c.identificador
    );

    SET IDENTITY_INSERT dbo.productos OFF;

    UPDATE i
    SET
        catalogo = l.auction_id,
        producto = l.product_id,
        precioBase = CASE WHEN l.base_price > 0.01 THEN l.base_price ELSE 0.02 END,
        comision = CASE WHEN l.commission_rate > 0.01 THEN l.commission_rate ELSE 0.02 END,
        subastado = CASE WHEN l.sold = 1 THEN 'si' ELSE 'no' END
    FROM dbo.itemsCatalogo i
    INNER JOIN dbo.app_lots l ON l.catalog_item_id = i.identificador;

    SET IDENTITY_INSERT dbo.itemsCatalogo ON;

    INSERT INTO dbo.itemsCatalogo (identificador, catalogo, producto, precioBase, comision, subastado)
    SELECT
        l.catalog_item_id,
        l.auction_id,
        l.product_id,
        CASE WHEN l.base_price > 0.01 THEN l.base_price ELSE 0.02 END,
        CASE WHEN l.commission_rate > 0.01 THEN l.commission_rate ELSE 0.02 END,
        CASE WHEN l.sold = 1 THEN 'si' ELSE 'no' END
    FROM dbo.app_lots l
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.itemsCatalogo i
        WHERE i.identificador = l.catalog_item_id
    );

    SET IDENTITY_INSERT dbo.itemsCatalogo OFF;

    ;WITH attendance_pairs AS (
        SELECT DISTINCT a.user_id, a.auction_id
        FROM dbo.app_attendance a
        UNION
        SELECT DISTINCT b.user_id, b.auction_id
        FROM dbo.app_bids b
        UNION
        SELECT DISTINCT p.buyer_user_id, p.auction_id
        FROM dbo.app_purchases p
    )
    INSERT INTO dbo.asistentes (numeroPostor, cliente, subasta)
    SELECT
        CAST((ABS(CONVERT(BIGINT, CHECKSUM(CONCAT(ap.user_id, ':', ap.auction_id)))) % 2147483646) + 1 AS INT),
        ap.user_id,
        ap.auction_id
    FROM attendance_pairs ap
    WHERE EXISTS (SELECT 1 FROM dbo.clientes c WHERE c.identificador = ap.user_id)
      AND EXISTS (SELECT 1 FROM dbo.subastas s WHERE s.identificador = ap.auction_id)
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.asistentes a
          WHERE a.cliente = ap.user_id
            AND a.subasta = ap.auction_id
      );

    UPDATE p
    SET
        asistente = a.identificador,
        item = l.catalog_item_id,
        importe = CASE WHEN b.amount > 0.01 THEN b.amount ELSE 0.02 END,
        ganador = CASE WHEN b.status = 'ganadora' THEN 'si' ELSE 'no' END
    FROM dbo.pujos p
    INNER JOIN dbo.app_bids b ON b.id = p.identificador
    INNER JOIN dbo.app_lots l ON l.id = b.lot_id
    CROSS APPLY (
        SELECT TOP 1 identificador
        FROM dbo.asistentes a
        WHERE a.cliente = b.user_id
          AND a.subasta = b.auction_id
        ORDER BY a.identificador
    ) a;

    SET IDENTITY_INSERT dbo.pujos ON;

    INSERT INTO dbo.pujos (identificador, asistente, item, importe, ganador)
    SELECT
        b.id,
        a.identificador,
        l.catalog_item_id,
        CASE WHEN b.amount > 0.01 THEN b.amount ELSE 0.02 END,
        CASE WHEN b.status = 'ganadora' THEN 'si' ELSE 'no' END
    FROM dbo.app_bids b
    INNER JOIN dbo.app_lots l ON l.id = b.lot_id
    CROSS APPLY (
        SELECT TOP 1 identificador
        FROM dbo.asistentes a
        WHERE a.cliente = b.user_id
          AND a.subasta = b.auction_id
        ORDER BY a.identificador
    ) a
    WHERE EXISTS (
        SELECT 1
        FROM dbo.itemsCatalogo i
        WHERE i.identificador = l.catalog_item_id
    )
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.pujos p
          WHERE p.identificador = b.id
      );

    SET IDENTITY_INSERT dbo.pujos OFF;

    UPDATE r
    SET
        subasta = p.auction_id,
        duenio = p.owner_user_id,
        producto = l.product_id,
        cliente = p.buyer_user_id,
        importe = CASE
            WHEN p.hammer_price > 0.01 THEN p.hammer_price
            WHEN p.total_amount > 0.01 THEN p.total_amount
            ELSE 0.02
        END,
        comision = CASE WHEN p.commission_amount > 0.01 THEN p.commission_amount ELSE 0.02 END
    FROM dbo.registroDeSubasta r
    INNER JOIN dbo.app_purchases p ON p.id = r.identificador
    INNER JOIN dbo.app_lots l ON l.id = p.lot_id;

    SET IDENTITY_INSERT dbo.registroDeSubasta ON;

    INSERT INTO dbo.registroDeSubasta (
        identificador,
        subasta,
        duenio,
        producto,
        cliente,
        importe,
        comision
    )
    SELECT
        p.id,
        p.auction_id,
        p.owner_user_id,
        l.product_id,
        p.buyer_user_id,
        CASE
            WHEN p.hammer_price > 0.01 THEN p.hammer_price
            WHEN p.total_amount > 0.01 THEN p.total_amount
            ELSE 0.02
        END,
        CASE WHEN p.commission_amount > 0.01 THEN p.commission_amount ELSE 0.02 END
    FROM dbo.app_purchases p
    INNER JOIN dbo.app_lots l ON l.id = p.lot_id
    WHERE EXISTS (SELECT 1 FROM dbo.subastas s WHERE s.identificador = p.auction_id)
      AND EXISTS (SELECT 1 FROM dbo.duenios d WHERE d.identificador = p.owner_user_id)
      AND EXISTS (SELECT 1 FROM dbo.productos pr WHERE pr.identificador = l.product_id)
      AND EXISTS (SELECT 1 FROM dbo.clientes c WHERE c.identificador = p.buyer_user_id)
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.registroDeSubasta r
          WHERE r.identificador = p.id
      );

    SET IDENTITY_INSERT dbo.registroDeSubasta OFF;
END;
GO

EXEC dbo.syncLegacyFromAppRuntime;
GO
