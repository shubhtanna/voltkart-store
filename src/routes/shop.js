const express = require('express');
const db = require('../db');
const { categories, products } = require('../catalog');
const { bySlug, inr } = require('../helpers');

const router = express.Router();

// Absolute base URL for the current request (no hard-coded domain).
const baseUrl = (req) => `${req.protocol}://${req.get('host')}`;

const SORTS = {
  popular: (a, b) => b.reviews - a.reviews,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  discount: (a, b) => b.mrp - b.price - (a.mrp - a.price),
};
const PRICE_BANDS = [
  { id: 'u1k', label: 'Under ₹1,000', test: (p) => p < 1000 },
  { id: '1-5k', label: '₹1,000 – ₹5,000', test: (p) => p >= 1000 && p <= 5000 },
  { id: '5-15k', label: '₹5,000 – ₹15,000', test: (p) => p > 5000 && p <= 15000 },
  { id: 'o15k', label: 'Above ₹15,000', test: (p) => p > 15000 },
];

function listing(req, res, { base, title, heading, items }) {
  const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const brands = asList(req.query.brand);
  const price = req.query.price;
  const sort = SORTS[req.query.sort] ? req.query.sort : 'popular';
  const inStock = req.query.instock === '1';

  let list = items.filter((p) => (!brands.length || brands.includes(p.brand)) && (!inStock || p.stock > 0));
  const band = PRICE_BANDS.find((b) => b.id === price);
  if (band) list = list.filter((p) => band.test(p.price));
  list = [...list].sort(SORTS[sort]);

  res.render('listing', {
    title, heading, base, list,
    allBrands: [...new Set(items.map((p) => p.brand))].sort(),
    brands, price, sort, inStock, PRICE_BANDS,
  });
}

router.get('/', (req, res) => {
  const deals = [...products].filter((p) => p.stock > 0).sort((a, b) => (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp).slice(0, 8);
  const best = [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4);
  res.render('home', { title: 'VoltKart | Headphones, Chargers, Smartwatches & Tech Accessories', deals, best });
});

router.get('/c/:slug', (req, res, next) => {
  const cat = categories.find((c) => c.slug === req.params.slug);
  if (!cat) return next();
  listing(req, res, { base: `/c/${cat.slug}`, title: `${cat.name} | VoltKart`, heading: cat.name, items: products.filter((p) => p.category === cat.slug) });
});

router.get('/search', (req, res) => {
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  const items = words.length
    ? products.filter((p) => {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.highlights.join(' ')}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
    : [];
  listing(req, res, { base: '/search', title: `Search: ${q} | VoltKart`, heading: q ? `Results for “${req.query.q}”` : 'Search', items });
});

router.get('/p/:slug', (req, res, next) => {
  const p = bySlug[req.params.slug];
  if (!p) return next();
  const cat = categories.find((c) => c.slug === p.category);
  const related = products.filter((x) => x.category === p.category && x.sku !== p.sku).slice(0, 4);
  const wished = req.session.userId ? !!db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND sku = ?').get(req.session.userId, p.sku) : false;
  res.render('product', { title: `${p.name} | VoltKart`, p, cat, related, wished });
});

router.get('/help', (req, res) => res.render('help', { title: 'Help & policies | VoltKart' }));

// Machine-readable product data for AI shopping agents.
router.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const urls = [
    { loc: `${base}/` },
    ...categories.map((c) => ({ loc: `${base}/c/${c.slug}` })),
    ...products.map((p) => ({ loc: `${base}/p/${p.slug}` })),
  ];
  res.type('application/xml').render('sitemap', { urls });
});

router.get('/llms.txt', (req, res) => {
  const base = baseUrl(req);
  const lines = [
    '# VoltKart',
    '',
    'VoltKart is an Indian online electronics store selling headphones, earbuds, speakers, smartwatches, chargers, keyboards, mice and gaming gear. Prices are in INR and include GST.',
    '',
    '## Products',
    '',
    ...products.map((p) => `- [${p.name}](${base}/p/${p.slug}): ${inr(p.price)}`),
    '',
    '## How to buy',
    '',
    '1. Open a product page and submit its "Add to cart" form (POST /cart/add with the product `sku`, optional `option` and `qty`, plus the `_csrf` token from the page) to put it in the cart.',
    '2. The cart page shows the items and total. Its "Proceed to checkout" link carries the cart as `/checkout?items=<sku>:<qty>,...`, so the same items open on any device without cookies.',
    '3. On the checkout page the shopper signs in (or creates an account) and completes the address and payment form to place the order. The order summary with product names is shown before sign-in.',
  ];
  res.type('text/plain; charset=utf-8').send(lines.join('\n'));
});

module.exports = router;
