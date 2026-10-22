const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const db = require('./src/db');
const { categories } = require('./src/catalog');
const { inr, discountPct, csrf, FREE_SHIPPING_FROM } = require('./src/helpers');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: 'vk.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 24 * 14 },
  }),
);
// Values every template needs.
app.use((req, res, next) => {
  res.locals.inr = inr;
  res.locals.discountPct = discountPct;
  res.locals.categories = categories;
  res.locals.cartCount = (req.session.cart || []).reduce((s, l) => s + l.qty, 0);
  res.locals.user = req.session.userId ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId) : null;
  res.locals.flash = req.session.flash || null;
  res.locals.path = req.path;
  res.locals.q = typeof req.query.q === 'string' ? req.query.q : '';
  res.locals.req = req;
  res.locals.FREE_SHIPPING_FROM = FREE_SHIPPING_FROM;
  delete req.session.flash;
  next();
});
app.use(csrf);

app.use(require('./src/routes/shop'));
app.use(require('./src/routes/account'));
app.use(require('./src/routes/cart'));

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', message: "We couldn't find that page. It may have moved or the product is no longer sold." }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again in a moment.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VoltKart running on http://localhost:${port}`));
