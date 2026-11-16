// Run once in App Service SSH with its existing private environment settings.
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../database/40-service-receipts.sql', import.meta.url), 'utf8');
if (!process.argv.includes('--apply')) {
  console.log('Plan: create service_receipt if absent. Existing accounts and orders are unchanged. Add --apply to execute.');
  process.exit(0);
}
for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (!process.env[key]) throw new Error(`Missing ${key}. Run in the App Service SSH environment.`);
}
const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}) } } : {}),
});
try {
  await db.query(sql);
  await db.query('SELECT receipt_id FROM service_receipt LIMIT 0');
  console.log('Service receipt schema is ready. Existing accounts and orders preserved.');
} catch (error) {
  console.error('Service receipt migration failed:', error.code || error.name);
  process.exitCode = 1;
} finally { await db.end(); }
