/*
  Demo/admin account for Lucas, with the same mobile privileges used by the
  main admin account: approved client, owner, platino category, and completed
  registration.
*/

DECLARE @userId INT;
DECLARE @countryCode INT = 32;
DECLARE @passwordHash VARCHAR(500) = '50f58974d14b92a4afcc40497a2db562fd8195ca6fddb57de949c14ef6d28492';

SELECT @userId = user_id
FROM dbo.app_legacy_user_metadata
WHERE LOWER(email) = 'l@gmail.com';

IF @userId IS NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = 8)
        SET @userId = 8;
    ELSE
        SELECT @userId = COALESCE(MAX(identificador), 0) + 1
        FROM dbo.personas
        WHERE identificador > 0;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.paises WHERE numero = @countryCode)
BEGIN
    INSERT INTO dbo.paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
    VALUES (@countryCode, CONCAT('Pais ', @countryCode), CONCAT('P', @countryCode), 'Sin datos', 'Sin datos', 'Sin datos');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = -900000)
BEGIN
    SET IDENTITY_INSERT dbo.personas ON;
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    VALUES (-900000, 'SISTEMA', 'Sistema', NULL, 'activo', NULL);
    SET IDENTITY_INSERT dbo.personas OFF;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.empleados WHERE identificador = -900000)
BEGIN
    INSERT INTO dbo.empleados (identificador, cargo, sector)
    VALUES (-900000, 'Sistema', NULL);
END;

IF EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = @userId)
BEGIN
    UPDATE dbo.personas
    SET documento = CONCAT('LPC-', @userId),
        nombre = 'Lucas Perez Ciccone',
        direccion = 'Av. del Libertador 4100, Buenos Aires',
        estado = 'activo'
    WHERE identificador = @userId;
END
ELSE
BEGIN
    SET IDENTITY_INSERT dbo.personas ON;
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    VALUES (@userId, CONCAT('LPC-', @userId), 'Lucas Perez Ciccone', 'Av. del Libertador 4100, Buenos Aires', 'activo', NULL);
    SET IDENTITY_INSERT dbo.personas OFF;
END;

MERGE dbo.app_legacy_user_metadata AS target
USING (
    SELECT
        user_id = @userId,
        email = 'l@gmail.com',
        first_name = 'Lucas',
        last_name = 'Perez Ciccone',
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
        verificador = -900000
WHEN NOT MATCHED THEN
    INSERT (identificador, numeroPais, admitido, categoria, verificador)
    VALUES (source.user_id, source.numeroPais, 'si', 'platino', -900000);

MERGE dbo.duenios AS target
USING (SELECT user_id = @userId, numeroPais = @countryCode) AS source
ON target.identificador = source.user_id
WHEN MATCHED THEN
    UPDATE SET
        numeroPais = source.numeroPais,
        verificacionFinanciera = 'si',
        verificacionJudicial = 'si',
        calificacionRiesgo = 1,
        verificador = -900000
WHEN NOT MATCHED THEN
    INSERT (
        identificador,
        numeroPais,
        verificacionFinanciera,
        verificacionJudicial,
        calificacionRiesgo,
        verificador
    )
    VALUES (source.user_id, source.numeroPais, 'si', 'si', 1, -900000);
GO
