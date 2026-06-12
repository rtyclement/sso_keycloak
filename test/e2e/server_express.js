require('dotenv').config();

const express = require('express');
const app     = express();
const kc      = require('./middleware/keycloak_express');

app.use(express.json());

// ─── Route publique (déclarée AVANT protect → échappe à l'authentification) ───
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── /api/*  : mode bearer, rôle 'api-access' ─────────────────────────────────
kc.protect(app, '/api/*', 'bearer', 'api-access');

// ─── tout le reste : mode session, rôle 'dashboard-access' ────────────────────
// (monte automatiquement /login, /callback, /backchannel-logout)
kc.protect(app, null, 'session', 'dashboard-access');

// Routes protégées
app.get('/api/info',  (req, res) => res.json({ message: 'ok', user: req.principal }));
app.get('/dashboard', (req, res) => res.json({ user: req.principal }));
app.get('/',          (req, res) => res.json({ user: req.principal })); // cible du redirect post-callback

const port = Number(process.env.APP_PORT || 9090);
app.listen(port, () => console.log(`[express] up on :${port}`));
