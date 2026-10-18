const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { bySku, requireLogin, safeNext } = require('../helpers');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect(safeNext(req.query.next));
  res.render('login', { title: 'Log in | VoltKart', next: safeNext(req.query.next), error: null, email: '' });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const next = safeNext(req.body.next);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash)) {
    return res.status(401).render('login', { title: 'Log in | VoltKart', next, error: 'Incorrect email or password.', email });
  }
  const { cart, coupon } = req.session;
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = user.id;
    req.session.cart = cart;
    if (coupon) req.session.coupon = coupon;
    res.redirect(next);
  });
});

router.get('/signup', (req, res) => {
  res.render('signup', { title: 'Create account | VoltKart', next: safeNext(req.query.next), errors: {}, form: {} });
});

router.post('/signup', (req, res) => {
  const form = {
    name: String(req.body.name || '').trim(),
    email: String(req.body.email || '').trim().toLowerCase(),
    phone: String(req.body.phone || '').replace(/\D/g, '').slice(-10),
  };
  const password = String(req.body.password || '');
  const next = safeNext(req.body.next);
  const errors = {};
  if (form.name.length < 2) errors.name = 'Please enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Please enter a valid email.';
  else if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(form.email)) errors.email = 'An account with this email already exists. Try logging in.';
  if (!/^[6-9]\d{9}$/.test(form.phone)) errors.phone = 'Please enter a valid 10-digit mobile number.';
  if (password.length < 8) errors.password = 'Use at least 8 characters.';
  if (Object.keys(errors).length) return res.status(400).render('signup', { title: 'Create account | VoltKart', next, errors, form });

  const info = db.prepare('INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)').run(form.name, form.email, form.phone, bcrypt.hashSync(password, 10));
  const { cart, coupon } = req.session;
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = Number(info.lastInsertRowid);
    req.session.cart = cart;
    if (coupon) req.session.coupon = coupon;
    req.session.flash = { type: 'ok', text: `Welcome to VoltKart, ${form.name.split(' ')[0]}! Use FIRST200 for ₹200 off your first order.` };
    res.redirect(next);
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/account', requireLogin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId)
    .map((o) => ({ ...o, items: JSON.parse(o.items) }));
  const wish = db.prepare('SELECT sku FROM wishlist WHERE user_id = ?').all(req.session.userId).map((w) => bySku[w.sku]).filter(Boolean);
  res.render('account', { title: 'My account | VoltKart', orders, wish });
});

router.post('/wishlist/toggle', requireLogin, (req, res) => {
  const sku = String(req.body.sku || '');
  if (bySku[sku]) {
    const has = db.prepare('SELECT 1 FROM wishlist WHERE user_id = ? AND sku = ?').get(req.session.userId, sku);
    if (has) db.prepare('DELETE FROM wishlist WHERE user_id = ? AND sku = ?').run(req.session.userId, sku);
    else db.prepare('INSERT INTO wishlist (user_id, sku) VALUES (?, ?)').run(req.session.userId, sku);
  }
  res.redirect(req.get('referer') || '/account');
});

module.exports = router;
