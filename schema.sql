-- VAROnChain — run once against the MySQL server to set up persistence for
-- the prediction game + Crowd Pulse Trader leaderboards.
-- Run as a user that can CREATE DATABASE/GRANT (e.g. root), then the app
-- connects as 'admin' using DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
-- from .env.local.

CREATE DATABASE IF NOT EXISTS varonchain
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 'admin' already exists — just grant it access to this database from any host.
GRANT ALL PRIVILEGES ON varonchain.* TO 'admin'@'%';
FLUSH PRIVILEGES;

USE varonchain;

CREATE TABLE IF NOT EXISTS predictions (
  id              VARCHAR(64) PRIMARY KEY,
  wallet          VARCHAR(64)  NOT NULL,
  fixture_id      BIGINT       NOT NULL,
  type            ENUM('goal','card','corner','penalty') NOT NULL,
  ts              BIGINT       NOT NULL,
  resolved_correct TINYINT(1)  NULL,
  resolved_at     BIGINT       NULL,
  INDEX idx_predictions_fixture (fixture_id),
  INDEX idx_predictions_wallet (wallet)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pulse_calls (
  id              VARCHAR(64) PRIMARY KEY,
  wallet          VARCHAR(64)  NOT NULL,
  fixture_id      BIGINT       NOT NULL,
  direction       ENUM('up','down') NOT NULL,
  baseline_pct    DOUBLE       NOT NULL,
  ts              BIGINT       NOT NULL,
  resolve_at      BIGINT       NOT NULL,
  resolved_correct TINYINT(1)  NULL,
  resolved_pct    DOUBLE       NULL,
  resolved_at     BIGINT       NULL,
  INDEX idx_pulse_fixture (fixture_id),
  INDEX idx_pulse_wallet (wallet)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
