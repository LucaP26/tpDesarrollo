/*
  Campos adicionales para medios de pago operativos.
  Guardan datos del titular y banco emisor sin romper la estructura existente.
*/

IF COL_LENGTH('dbo.app_payment_methods', 'holder_first_name') IS NULL
BEGIN
    ALTER TABLE dbo.app_payment_methods
    ADD holder_first_name VARCHAR(150) NULL;
END;
GO

IF COL_LENGTH('dbo.app_payment_methods', 'holder_last_name') IS NULL
BEGIN
    ALTER TABLE dbo.app_payment_methods
    ADD holder_last_name VARCHAR(150) NULL;
END;
GO

IF COL_LENGTH('dbo.app_payment_methods', 'issuing_bank') IS NULL
BEGIN
    ALTER TABLE dbo.app_payment_methods
    ADD issuing_bank VARCHAR(120) NULL;
END;
GO
