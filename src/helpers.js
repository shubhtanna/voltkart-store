const crypto = require('node:crypto');
const { products } = require('./catalog');

const FREE_SHIPPING_FROM = 499;
const SHIPPING_FEE = 49;
const COD_LIMIT = 10000;

const COUPONS = {
  VOLT10: { label: '10% off (up to ₹1,000) on orders above ₹2,000', min: 2000, apply: (s) => Math.min(1000, Math.round(s * 0.1)) },
  FIRST200: { label: '₹200 off your first order above ₹1,499', min: 1499, firstOrderOnly: true, apply: () => 200 },
};

const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const discountPct = (p) => Math.round((1 - p.price / p.mrp) * 100);

function cartSummary(session, { isFirstOrder = false } = {}) {
  const lines = (session.cart || [])
    .map((l) => ({ ...l, product: bySku[l.sku] }))
    .filter((l) => l.product)
    .map((l) => ({ ...l, total: l.product.price * l.qty }));
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  let discount = 0;
  let couponError = null;
  const code = session.coupon;
  if (code) {
    const c = COUPONS[code];
    if (!c) couponError = 'That coupon code is not valid.';
    else if (subtotal < c.min) couponError = `${code} needs a cart total of at least ${inr(c.min)}.`;
    else if (c.firstOrderOnly && !isFirstOrder) couponError = `${code} is only for your first order.`;
    else discount = c.apply(subtotal);
  }
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  return {
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal,
    discount,
    coupon: discount ? code : null,
    couponError,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
  };
}

// Per-session CSRF token for every form POST.
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST' && req.body?._csrf !== req.session.csrf) {
    return res.status(403).render('error', { title: 'Session expired', message: 'Your session expired. Please go back, refresh the page and try again.' });
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.session.userId) return next();
  req.session.flash = { type: 'info', text: 'Please log in or create an account to continue.' };
  res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');

module.exports = { COUPONS, COD_LIMIT, FREE_SHIPPING_FROM, bySku, bySlug, inr, discountPct, cartSummary, csrf, requireLogin, safeNext };
