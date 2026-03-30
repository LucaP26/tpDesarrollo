/*
  Fecha de vencimiento opcional para medios de pago operativos.
*/

IF COL_LENGTH('dbo.app_payment_methods', 'expiration_date') IS NULL
BEGIN
    ALTER TABLE dbo.app_payment_methods
    ADD expiration_date VARCHAR(10) NULL;
END;
GO
