const express = require('express');
const db = require('../db');
const { COUPONS, COD_LIMIT, bySku, cartSummary, requireLogin } = require('../helpers');

const router = express.Router();

const isFirstOrder = (userId) => !userId || !db.prepare('SELECT 1 FROM orders WHERE user_id = ?').get(userId);

router.post('/cart/add', (req, res) => {
  const p = bySku[req.body.sku];
  if (!p) return res.redirect('/');
  if (p.stock === 0) {
    req.session.flash = { type: 'error', text: `${p.name} is out of stock.` };
    return res.redirect(`/p/${p.slug}`);
  }
  const option = p.options ? String(req.body.option || '') : '';
  if (p.options && !p.options.values.includes(option)) {
    req.session.flash = { type: 'error', text: `Please choose a ${p.options.name.toLowerCase()}.` };
    return res.redirect(`/p/${p.slug}`);
  }
  const qty = Math.max(1, Math.min(5, parseInt(req.body.qty, 10) || 1));
  const cart = req.session.cart || [];
  const line = cart.find((l) => l.sku === p.sku && l.option === option);
  if (line) line.qty = Math.min(5, Math.min(p.stock, line.qty + qty));
  else cart.push({ sku: p.sku, option, qty: Math.min(qty, p.stock) });
  req.session.cart = cart;
  if (req.body.buynow) return res.redirect('/checkout');
  req.session.flash = { type: 'ok', text: `Added to cart: ${p.name}` };
  res.redirect('/cart');
});

router.get('/cart', (req, res) => {
  res.render('cart', { title: 'Cart | VoltKart', cart: cartSummary(req.session, { isFirstOrder: isFirstOrder(req.session.userId) }), COUPONS });
});

router.post('/cart/update', (req, res) => {
  const cart = req.session.cart || [];
  const qty = req.body.remove ? 0 : parseInt(req.body.qty, 10) || 0;
  const line = cart.find((l) => l.sku === req.body.sku && l.option === (req.body.option || ''));
  if (line) line.qty = Math.max(0, Math.min(5, qty));
  req.session.cart = cart.filter((l) => l.qty > 0);
  res.redirect('/cart');
});

router.post('/cart/coupon', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (req.body.remove || !code) delete req.session.coupon;
  else req.session.coupon = code;
  res.redirect('/cart');
});

router.get('/checkout', requireLogin, (req, res) => {
  const cart = cartSummary(req.session, { isFirstOrder: isFirstOrder(req.session.userId) });
  if (!cart.count) return res.redirect('/cart');
  const saved = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC').get(req.session.userId) || {};
  res.render('checkout', { title: 'Checkout | VoltKart', cart, form: saved, errors: {}, payment: 'upi', COD_LIMIT });
});

router.post('/checkout', requireLogin, (req, res) => {
  const cart = cartSummary(req.session, { isFirstOrder: isFirstOrder(req.session.userId) });
  if (!cart.count) return res.redirect('/cart');
  const form = {
    line1: String(req.body.line1 || '').trim(),
    city: String(req.body.city || '').trim(),
    state: String(req.body.state || '').trim(),
    pincode: String(req.body.pincode || '').trim(),
  };
  const payment = ['upi', 'card', 'cod'].includes(req.body.payment) ? req.body.payment : '';
  const errors = {};
  if (form.line1.length < 8) errors.line1 = 'Please enter your full address.';
  if (!form.city) errors.city = 'Required';
  if (!form.state) errors.state = 'Required';
  if (!/^\d{6}$/.test(form.pincode)) errors.pincode = 'Enter a 6-digit PIN code';
  if (!payment) errors.payment = 'Choose a payment method.';
  if (payment === 'cod' && cart.total > COD_LIMIT) errors.payment = `Cash on delivery is available on orders up to ₹${COD_LIMIT.toLocaleString('en-IN')}.`;
  for (const l of cart.lines) if (l.product.stock < l.qty) errors.stock = `${l.product.name} has only ${l.product.stock} left.`;
  if (Object.keys(errors).length) return res.status(400).render('checkout', { title: 'Checkout | VoltKart', cart, form, errors, payment, COD_LIMIT });

  const id = 'VK' + Date.now().toString().slice(-9);
  const items = cart.lines.map((l) => ({ sku: l.sku, name: l.product.name, option: l.option, qty: l.qty, price: l.product.price }));
  db.prepare('INSERT INTO orders (id, user_id, items, subtotal, discount, shipping, total, coupon, payment, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.session.userId, JSON.stringify(items), cart.subtotal, cart.discount, cart.shipping, cart.total, cart.coupon, payment, `${form.line1}, ${form.city}, ${form.state} ${form.pincode}`);
  db.prepare('DELETE FROM addresses WHERE user_id = ?').run(req.session.userId);
  db.prepare('INSERT INTO addresses (user_id, line1, city, state, pincode) VALUES (?, ?, ?, ?, ?)').run(req.session.userId, form.line1, form.city, form.state, form.pincode);
  req.session.cart = [];
  delete req.session.coupon;
  res.redirect(`/order/${id}`);
});

router.get('/order/:id', requireLogin, (req, res, next) => {
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
  if (!o) return next();
  res.render('order', { title: 'Order placed | VoltKart', o: { ...o, items: JSON.parse(o.items) } });
});

module.exports = router;
