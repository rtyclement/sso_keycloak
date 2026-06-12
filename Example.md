# Implémentation du module dans votre application Node.js

L'API du module repose sur une classe `Keycloak` et un objet `DRIVERS`. L'instance est créée une fois, puis la méthode `protect()` est appelée pour chaque groupe de routes à sécuriser.

```javascript
const { Keycloak, DRIVERS } = require('sso_keycloak');
```

---

## Configuration commune

Les variables d'environnement attendues dans votre `.env` :

```javascript
KEYCLOAK_AUTH_URL="http://votre-keycloak:8080/auth"
KEYCLOAK_REALM="votre-realm"
KEYCLOAK_CLIENT_ID="votre-client"
KEYCLOAK_CLIENT_SECRET="votre-secret"
KEYCLOAK_REDIRECT_URI="http://votre-app/callback"
SESSION_SECRET="votre-secret-de-session"
KEYCLOAK_ALLOW_HTTP=true // Optionnel => Uniquement en Developpement 
```

---

## Mode session (login / mot de passe)

Le flow complet Authorization Code + PKCE. L'utilisateur est redirigé vers Keycloak, s'authentifie, et revient sur l'application. Les routes `/login`, `/callback` et `/backchannel-logout` sont montées automatiquement au premier appel à `protect()` en mode session.

### Express

*Dans un fichier `sso_middleware.js`*

```javascript
const { Keycloak, DRIVERS } = require('sso_keycloak');

const kc = new Keycloak(DRIVERS.EXPRESS, {
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUri:   process.env.KEYCLOAK_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});

module.exports = kc;
```

*Dans votre `index.js` ou point d'entrée*

```javascript
const express = require('express');
const app     = express();
const kc      = require('./middleware/sso_middleware');

// Les routes déclarées AVANT protect() échappent à l'authentification
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protège toutes les routes suivantes en mode session
// Le 4e paramètre (rôle) est optionnel — ici on exige le rôle 'dashboard-access'
kc.protect(app, null, 'session', 'dashboard-access');

// Routes protégées
app.get('/dashboard', (req, res) => res.json({ user: req.principal }));
app.get('/profile',   (req, res) => res.json({ user: req.principal }));

app.listen(9090);
```

### Fastify

*Dans un fichier `sso_middleware.js`*

```javascript
const { Keycloak, DRIVERS } = require('sso_keycloak');

const kc = new Keycloak(DRIVERS.FASTIFY, {
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUri:   process.env.KEYCLOAK_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});

module.exports = kc;
```

*Dans votre `index.js` ou point d'entrée*

```javascript
const fastify = require('fastify')({ logger: true });
const kc      = require('./middleware/sso_middleware');

async function start() {
    kc.protect(fastify, null, 'session', 'dashboard-access');

    fastify.get('/dashboard', async (req) => ({ user: req.principal }));
    fastify.get('/profile',   async (req) => ({ user: req.principal }));

    await fastify.listen({ port: 9090, host: '0.0.0.0' });
}

start().catch(err => { console.error(err); process.exit(1); });
```

*Prérequis Fastify*

```bash
npm install @fastify/session @fastify/cookie @fastify/formbody
```

---

## Mode bearer (access token)

Chaque requête doit porter un header `Authorization: Bearer <token>`. Le token est validé par Keycloak via introspection à chaque requête.

### Express

*Dans un fichier `sso_middleware.js`*

```javascript
const { Keycloak, DRIVERS } = require('sso_keycloak');

const kc = new Keycloak(DRIVERS.EXPRESS, {
    issuerUrl:    `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:     process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    allowHttp:    process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});

module.exports = kc;
```

*Dans votre `index.js` ou point d'entrée*

```javascript
const express = require('express');
const app     = express();
const kc      = require('./middleware/sso_middleware');

app.use(express.json());

// Protège toutes les routes en bearer, exige le rôle 'api-access'
kc.protect(app, null, 'bearer', 'api-access');

app.get('/info', (req, res) => res.json({ message: 'ok', user: req.principal }));

app.listen(8080);
```

### Fastify

*Dans un fichier `sso_middleware.js`*

```javascript
const { Keycloak, DRIVERS } = require('sso_keycloak');

const kc = new Keycloak(DRIVERS.FASTIFY, {
    issuerUrl:    `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:     process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    allowHttp:    process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});

module.exports = kc;
```

*Dans votre `index.js` ou point d'entrée*

```javascript
const fastify = require('fastify')({ logger: true });
const kc      = require('./middleware/sso_middleware');

async function start() {
    kc.protect(fastify, null, 'bearer', 'api-access');

    fastify.get('/info', async (req) => ({ message: 'ok', user: req.principal }));

    await fastify.listen({ port: 8080, host: '0.0.0.0' });
}

start().catch(err => { console.error(err); process.exit(1); });
```

---

## Granularité — plusieurs modes sur la même application

`protect()` s'applique dans l'ordre de déclaration. La première règle qui matche une URL gagne — les suivantes l'ignorent.

```javascript
// /swagger accessible en session sans contrainte de rôle
kc.protect(app, '/swagger/*', 'session');

// /admin en session avec rôle requis
kc.protect(app, '/admin/*', 'session', 'admin');

// tout le reste de l'API en bearer avec rôle requis
kc.protect(app, null, 'bearer', 'api-access');
```

Les routes déclarées **avant** tout appel à `protect()` échappent à toute authentification :

```javascript
app.get('/health', handler);              // public — déclaré avant protect()
kc.protect(app, null, 'bearer', 'api-access');
app.get('/api/data', handler);            // protégé en bearer
```

### Paramètre `routes`

| Valeur | Comportement |
|---|---|
| `null` | S'applique à toutes les routes suivantes |
| `'/api'` | Exact — matche uniquement `/api` |
| `'/api/*'` | Glob — matche `/api` et tous ses descendants |
| `['/a', '/b/*']` | Tableau — plusieurs patterns sur la même règle |

### Paramètre `roles` (optionnel)

Restreint l'accès à un ou plusieurs rôles Keycloak. Si absent, tout utilisateur authentifié est accepté.

```javascript
kc.protect(app, '/admin',   'session', 'admin');              // un seul rôle
kc.protect(app, '/reports', 'bearer',  ['admin', 'analyst']); // plusieurs rôles
kc.protect(app, '/info',    'bearer');                        // authentifié, sans contrainte de rôle
```