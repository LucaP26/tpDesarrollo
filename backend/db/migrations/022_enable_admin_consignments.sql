/*
  The demo/admin mobile account must always be able to consign assets.
  Keep these accounts approved, completed, and present as both clients and
  owners in the legacy schema that the app now uses as its source.
*/

DECLARE @systemPersona INT = -900000;
DECLARE @systemEmpleado INT = -900000;

IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE identificador = @systemPersona)
BEGIN
    SET IDENTITY_INSERT dbo.personas ON;
    INSERT INTO dbo.personas (identificador, documento, nombre, direccion, estado, foto)
    VALUES (@systemPersona, 'SISTEMA', 'Sistema', NULL, 'activo', NULL);
    SET IDENTITY_INSERT dbo.personas OFF;
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.empleados WHERE identificador = -900000)
BEGIN
    INSERT INTO dbo.empleados (identificador, cargo, sector)
    VALUES (-900000, 'Sistema', NULL);
END;
GO

UPDATE m
SET
    registration_stage = 'registro_completado',
    roles_json = '["cliente","duenio"]'
FROM dbo.app_legacy_user_metadata m
WHERE LOWER(m.email) IN ('l@gmail.com', 'm@gmail.com', 'p@gmail.com', 'admin@gmail.com', 'admin@atelier.local');
GO

UPDATE p
SET estado = 'activo'
FROM dbo.personas p
INNER JOIN dbo.app_legacy_user_metadata m ON m.user_id = p.identificador
WHERE LOWER(m.email) IN ('l@gmail.com', 'm@gmail.com', 'p@gmail.com', 'admin@gmail.com', 'admin@atelier.local');
GO

;WITH admin_accounts AS (
    SELECT DISTINCT
        m.user_id,
        numeroPais = COALESCE(c.numeroPais, d.numeroPais, 32)
    FROM dbo.app_legacy_user_metadata m
    LEFT JOIN dbo.clientes c ON c.identificador = m.user_id
    LEFT JOIN dbo.duenios d ON d.identificador = m.user_id
    WHERE LOWER(m.email) IN ('l@gmail.com', 'm@gmail.com', 'p@gmail.com', 'admin@gmail.com', 'admin@atelier.local')
)
INSERT INTO dbo.paises (numero, nombre, nombreCorto, capital, nacionalidad, idiomas)
SELECT DISTINCT
    a.numeroPais,
    CONCAT('Pais ', CONVERT(VARCHAR(20), a.numeroPais)),
    CONCAT('P', CONVERT(VARCHAR(20), a.numeroPais)),
    'Sin datos',
    'Sin datos',
    'Sin datos'
FROM admin_accounts a
WHERE a.numeroPais IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.paises p
      WHERE p.numero = a.numeroPais
  );
GO

;WITH admin_accounts AS (
    SELECT DISTINCT
        m.user_id,
        numeroPais = COALESCE(c.numeroPais, d.numeroPais, 32)
    FROM dbo.app_legacy_user_metadata m
    LEFT JOIN dbo.clientes c ON c.identificador = m.user_id
    LEFT JOIN dbo.duenios d ON d.identificador = m.user_id
    WHERE LOWER(m.email) IN ('l@gmail.com', 'm@gmail.com', 'p@gmail.com', 'admin@gmail.com', 'admin@atelier.local')
)
MERGE dbo.clientes AS target
USING admin_accounts AS source
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
GO

;WITH admin_accounts AS (
    SELECT DISTINCT
        m.user_id,
        numeroPais = COALESCE(c.numeroPais, d.numeroPais, 32)
    FROM dbo.app_legacy_user_metadata m
    LEFT JOIN dbo.clientes c ON c.identificador = m.user_id
    LEFT JOIN dbo.duenios d ON d.identificador = m.user_id
    WHERE LOWER(m.email) IN ('l@gmail.com', 'm@gmail.com', 'p@gmail.com', 'admin@gmail.com', 'admin@atelier.local')
)
MERGE dbo.duenios AS target
USING admin_accounts AS source
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
