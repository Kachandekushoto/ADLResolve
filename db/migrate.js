/**
 * Applies db/schema.sql against the configured MySQL server.
 * Run with: npm run migrate
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('Applying schema.sql...');
  await connection.query(sql);
  // Keep existing installations compatible with the authorized role names.
  await connection.query("ALTER TABLE itresolve.admin_users MODIFY role ENUM('admin','it_staff','agent') NOT NULL DEFAULT 'it_staff'");
  await connection.query("UPDATE itresolve.admin_users SET role = 'it_staff' WHERE role = 'agent'");
  await connection.query("ALTER TABLE itresolve.admin_users MODIFY role ENUM('admin','it_staff') NOT NULL DEFAULT 'it_staff'");
  console.log('Schema applied successfully.');
  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
