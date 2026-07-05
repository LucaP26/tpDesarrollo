/*
  Campos de flujo de consignacion exigidos por el enunciado.
  Se mantienen como metadata operativa porque el esquema legado no tiene
  columnas para evidencias, estados de inspeccion, acuerdos de devolucion,
  cuentas de liquidacion ni respuesta del usuario ante base/comision.
*/

IF COL_LENGTH('dbo.app_consignments', 'declared_return_charge_agreement') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD declared_return_charge_agreement BIT NOT NULL CONSTRAINT df_app_consignments_return_charge DEFAULT 0;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'lawful_origin_evidence_json') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD lawful_origin_evidence_json NVARCHAR(MAX) NOT NULL CONSTRAINT df_app_consignments_origin_evidence DEFAULT '[]';
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'item_count') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD item_count INT NOT NULL CONSTRAINT df_app_consignments_item_count DEFAULT 1;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'collection_name') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD collection_name VARCHAR(250) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'payout_account') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD payout_account NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'inspection_address') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD inspection_address VARCHAR(350) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'return_shipping_cost') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD return_shipping_cost DECIMAL(18, 2) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'return_shipping_note') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD return_shipping_note NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'origin_doubt_reported') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD origin_doubt_reported BIT NOT NULL CONSTRAINT df_app_consignments_origin_doubt DEFAULT 0;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'origin_doubt_notes') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD origin_doubt_notes NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.app_consignments', 'authority_reported_at') IS NULL
BEGIN
    ALTER TABLE dbo.app_consignments
    ADD authority_reported_at DATETIME2 NULL;
END;
GO
