/*
  Watchlist persistida por usuario para subastas programadas.
*/

IF OBJECT_ID('dbo.app_watchlist', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_watchlist (
        user_id INT NOT NULL,
        auction_id INT NOT NULL,
        created_at DATETIME2 NOT NULL,
        CONSTRAINT pk_app_watchlist PRIMARY KEY (user_id, auction_id),
        CONSTRAINT fk_app_watchlist_user FOREIGN KEY (user_id) REFERENCES dbo.app_users(id),
        CONSTRAINT fk_app_watchlist_auction FOREIGN KEY (auction_id) REFERENCES dbo.app_auctions(id)
    );
END;
GO
