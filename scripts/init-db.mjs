// One-time (idempotent, re-runnable) DB setup: `npm run db:init`.
// Reads schema.sql and DB_* creds from .env.local.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader — avoids adding a dotenv dependency for one script.
for (const line of readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] ??= match[2];
}

const schema = readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");

// Connect without a database selected — the script itself creates it.
const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
});

try {
  console.log(`Connecting to ${process.env.DB_HOST}:${process.env.DB_PORT} as ${process.env.DB_USER}…`);
  await connection.query(schema);
  console.log("✓ schema.sql applied — database, grant, and tables are up to date.");
} finally {
  await connection.end();
}
