# VoltKart

Storefront for VoltKart, an online shop for phone and tech accessories: earbuds, headphones, speakers, smartwatches, chargers, keyboards, mice and gaming gear.

> This is a demo store. No real orders, payments or deliveries are processed.

Node.js 24, Express 5, EJS templates and SQLite (`node:sqlite`).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database (`voltkart.db`) is created on first start.

## Environment

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session cookies. Required in production. |
| `NODE_ENV` | `production` enables secure cookies. |
| `PORT` | Defaults to 3000. |
| `DB_PATH` | Optional path for the SQLite file. |

## Features

- Categories, search, brand/price/stock filters and sorting
- Product pages with options (colour, size, cable type), specs and stock levels
- Customer accounts (bcrypt-hashed passwords), wishlist, order history
- Login required to check out
- Coupons: `VOLT10`, `FIRST200`; free delivery above ₹499; COD up to ₹10,000
- CSRF protection on every form

## Layout

| Path | What's there |
|---|---|
| `server.js` | App setup, sessions, shared template values |
| `src/catalog.js` | Categories and products |
| `src/routes/` | `shop.js`, `account.js`, `cart.js` (cart, coupons, checkout, orders) |
| `views/` | EJS templates |
| `public/` | CSS, JS, robots.txt |

Hosted on Render. Product photos from [Unsplash](https://unsplash.com).
