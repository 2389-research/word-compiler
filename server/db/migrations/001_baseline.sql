-- 001_baseline.sql
--
-- The baseline schema is installed by server/db/schema.ts::createSchema()
-- using CREATE TABLE IF NOT EXISTS. This migration exists only to claim
-- version 1 in schema_migrations so that the runner works correctly on
-- fresh databases and so future migrations (002+) can assume a versioned
-- baseline. It deliberately performs no DDL.
SELECT 1;
