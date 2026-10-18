const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, '..', 'voltkart.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    line1 TEXT, city TEXT, state TEXT, pincode TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    items TEXT NOT NULL,
    subtotal INTEGER, discount INTEGER, shipping INTEGER, total INTEGER,
    coupon TEXT, payment TEXT, address TEXT, status TEXT DEFAULT 'Confirmed'
  );
  CREATE TABLE IF NOT EXISTS wishlist (
    user_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    PRIMARY KEY (user_id, sku)
  );
`);

module.exports = db;
