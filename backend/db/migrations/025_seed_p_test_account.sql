/*
  Test bidder/owner account used for cross-owner sale scenarios:
  p@gmail.com wins => m@gmail.com receives the owner sale notification,
  m@gmail.com wins => p@gmail.com receives it.
*/

DECLARE @userId INT;
DECLARE @countryCode INT = 32;
DECLARE @systemId INT = -900000;
DECLARE @passwordHash VARCHAR(500) = '50f58974d14b92a4afcc40497a2db562fd8195ca6fddb57de949c14ef6d28492';
DECLARE @verifiedAt DATETIME2 = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.paises WHERE numero = @countryCode)
BEGIN
    INSERT INTO dbo.paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
    VALUES (@countryCode, CONCAT('Pais ', @countryCode), CONCAT('P', @countryCode), 'Sin datos', 'Sin datos', 'Sin datos');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = @systemId)
BEGIN
    SET IDENTITY_INSERT dbo.personas ON;
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    VALUES (@systemId, 'SISTEMA', 'Sistema', NULL, 'activo', NULL);
    SET IDENTITY_INSERT dbo.personas OFF;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.empleados WHERE identificador = @systemId)
BEGIN
    INSERT INTO dbo.empleados (identificador, cargo, sector)
    VALUES (@systemId, 'Sistema', NULL);
END;

SELECT @userId = user_id
FROM dbo.app_legacy_user_metadata
WHERE LOWER(email) = 'p@gmail.com';

IF @userId IS NULL
BEGIN
    SELECT @userId = CASE WHEN COALESCE(MAX(identificador), 0) < 12 THEN 12 ELSE COALESCE(MAX(identificador), 0) + 1 END
    FROM dbo.personas
    WHERE identificador > 0;
END;

IF EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = @userId)
BEGIN
    UPDATE dbo.personas
    SET documento = CONCAT('PGM-', @userId),
        nombre = 'P Test',
        direccion = 'Av. Alvear 1888, Recoleta, Buenos Aires',
        estado = 'activo'
    WHERE identificador = @userId;
END
ELSE
BEGIN
    SET IDENTITY_INSERT dbo.personas ON;
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    VALUES (@userId, CONCAT('PGM-', @userId), 'P Test', 'Av. Alvear 1888, Recoleta, Buenos Aires', 'activo', NULL);
    SET IDENTITY_INSERT dbo.personas OFF;
END;

MERGE dbo.app_legacy_user_metadata AS target
USING (
    SELECT
        user_id = @userId,
        email = 'p@gmail.com',
        first_name = 'P',
        last_name = 'Test',
        gender = 'otro',
        birth_date = '1990-01-01',
        registration_stage = 'registro_completado',
        roles_json = '["cliente","duenio"]',
        password_hash = @passwordHash
) AS source
ON LOWER(target.email) = source.email
WHEN MATCHED THEN
    UPDATE SET
        user_id = source.user_id,
        first_name = source.first_name,
        last_name = source.last_name,
        gender = source.gender,
        birth_date = source.birth_date,
        registration_stage = source.registration_stage,
        roles_json = source.roles_json,
        password_hash = source.password_hash
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
        source.user_id,
        source.email,
        source.first_name,
        source.last_name,
        source.gender,
        source.birth_date,
        source.registration_stage,
        source.roles_json,
        source.password_hash,
        NULL,
        NULL,
        NULL
    );

MERGE dbo.clientes AS target
USING (SELECT user_id = @userId, numeroPais = @countryCode) AS source
ON target.identificador = source.user_id
WHEN MATCHED THEN
    UPDATE SET
        numeroPais = source.numeroPais,
        admitido = 'si',
        categoria = 'platino',
        verificador = @systemId
WHEN NOT MATCHED THEN
    INSERT (identificador, numeroPais, admitido, categoria, verificador)
    VALUES (source.user_id, source.numeroPais, 'si', 'platino', @systemId);

MERGE dbo.duenios AS target
USING (SELECT user_id = @userId, numeroPais = @countryCode) AS source
ON target.identificador = source.user_id
WHEN MATCHED THEN
    UPDATE SET
        numeroPais = source.numeroPais,
        verificacionFinanciera = 'si',
        verificacionJudicial = 'si',
        calificacionRiesgo = 1,
        verificador = @systemId
WHEN NOT MATCHED THEN
    INSERT (
        identificador,
        numeroPais,
        verificacionFinanciera,
        verificacionJudicial,
        calificacionRiesgo,
        verificador
    )
    VALUES (source.user_id, source.numeroPais, 'si', 'si', 1, @systemId);

;WITH seed AS (
    SELECT type = 'tarjeta_credito', display_name = 'Visa Infinite p@gmail.com', currency = 'USD', issuer_country = 'AR', available_amount = CAST(18000000.00 AS DECIMAL(18, 2)), last_four = '2424', holder_first_name = 'P', holder_last_name = 'Test', issuing_bank = 'Galicia', expiration_date = '2031-12-31'
    UNION ALL SELECT 'cuenta_bancaria', 'HSBC Premier USD p@gmail.com', 'USD', 'AR', CAST(25000000.00 AS DECIMAL(18, 2)), NULL, 'P', 'Test', 'HSBC', NULL
    UNION ALL SELECT 'cheque_certificado', 'Cheque certificado ARS p@gmail.com', 'ARS', 'AR', CAST(900000000.00 AS DECIMAL(18, 2)), NULL, 'P', 'Test', 'Banco Nacion', NULL
),
numbered AS (
    SELECT
        id = (SELECT COALESCE(MAX(id), 0) FROM dbo.app_payment_methods) + ROW_NUMBER() OVER (ORDER BY display_name),
        *
    FROM seed seed_row
)
MERGE dbo.app_payment_methods AS target
USING numbered AS source
ON target.user_id = @userId
   AND target.display_name = source.display_name
WHEN MATCHED THEN
    UPDATE SET
        type = source.type,
        currency = source.currency,
        issuer_country = source.issuer_country,
        available_amount = source.available_amount,
        status = 'verificado',
        last_four = source.last_four,
        holder_first_name = source.holder_first_name,
        holder_last_name = source.holder_last_name,
        issuing_bank = source.issuing_bank,
        expiration_date = source.expiration_date,
        verified_at = @verifiedAt
WHEN NOT MATCHED THEN
    INSERT (
        id,
        user_id,
        type,
        display_name,
        currency,
        issuer_country,
        available_amount,
        status,
        last_four,
        holder_first_name,
        holder_last_name,
        issuing_bank,
        expiration_date,
        verified_at
    )
    VALUES (
        source.id,
        @userId,
        source.type,
        source.display_name,
        source.currency,
        source.issuer_country,
        source.available_amount,
        'verificado',
        source.last_four,
        source.holder_first_name,
        source.holder_last_name,
        source.issuing_bank,
        source.expiration_date,
        @verifiedAt
    );
