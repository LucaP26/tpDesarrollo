/*
  Agrega el estado temporal necesario para que cada lote tenga una ventana
  de puja propia y avance automaticamente cuando vence.
*/

IF COL_LENGTH('dbo.app_lots', 'bidding_started_at') IS NULL
BEGIN
    ALTER TABLE dbo.app_lots
    ADD bidding_started_at DATETIME NULL;
END;
GO

IF COL_LENGTH('dbo.app_lots', 'bid_deadline_at') IS NULL
BEGIN
    ALTER TABLE dbo.app_lots
    ADD bid_deadline_at DATETIME NULL;
END;
GO
