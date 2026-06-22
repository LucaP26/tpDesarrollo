/*
  Apunta cada lote curado a una imagen local incluida en el APK.
  Asi el catalogo no depende de servicios externos para verse completo.
*/

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_leica_m6"]'
WHERE id = 5101;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_chesterfield"]'
WHERE id = 5102;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_thorens_td160"]'
WHERE id = 5103;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_omega_seamaster"]'
WHERE id = 5201;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_litografia"]'
WHERE id = 5202;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_montblanc"]'
WHERE id = 5203;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_bronce_vertical"]'
WHERE id = 5301;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_cartier_tank"]'
WHERE id = 5302;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_perriand_table"]'
WHERE id = 5303;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_riviera_diamonds"]'
WHERE id = 5401;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_royal_oak"]'
WHERE id = 5402;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_rolex_daydate"]'
WHERE id = 5403;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_patek_3940"]'
WHERE id = 5501;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_ferrari_275"]'
WHERE id = 5502;
GO

UPDATE dbo.app_lots
SET image_urls_json = '["drawable://lot_birkin_himalaya"]'
WHERE id = 5503;
GO
