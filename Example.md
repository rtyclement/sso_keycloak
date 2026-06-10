# Implementation du module comme middleware dans votre application NodeJs

## Mode d'authentification par login/mot de passe via session

- ### Implementation pour Express

*Dans un fichier sso_middleware.js*
```javascript
const express = require('express');
const session = require('express-session');
const { createSso } = require('sso_keycloak');

const envConfig = {
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUri:   process.env.KEYCLOAK_REDIRECT_URI,
    requiredRole:  process.env.KEYCLOAK_CLIENT_ROLE,
    sessionSecret: process.env.SESSION_SECRET,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
};

module.exports = createSso({ express, session }, envConfig);
```

- ### Implementation pour Fastify

*Dans un fichier sso_middleware.js*
```javascript
const session  = require('@fastify/session');
const cookie   = require('@fastify/cookie');
const formbody = require('@fastify/formbody');
const { createSso } = require('sso_keycloak');

const envConfig = {
    framework: 'fastify'
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUri:   process.env.KEYCLOAK_REDIRECT_URI,
    requiredRole:  process.env.KEYCLOAK_CLIENT_ROLE,
    sessionSecret: process.env.SESSION_SECRET,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
};

module.exports = createSso({ session, cookie, formbody }, envConfig);
```

*Prérequis d'installation*
```powershell
npm install @fastify/session @fastify/cookie @fastify/formbody
```

## Mode d'authentification par access token 

- ### Implementation pour Express

*Dans un fichier sso_middleware.js*
```javascript
const express = require('express');
const { createSso } = require('sso_keycloak');

const envConfig = {
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    requiredRole:  process.env.KEYCLOAK_CLIENT_ROLE,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
};
module.exports = createSso({ express}, envConfig);
```

- ### Implementation pour Fastify

```javascript
const { createSso } = require('sso_keycloak');

module.exports = createSso({}, {
    framework:    'fastify',
    issuerUrl:    `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:     process.env.KEYCLOAK_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    requiredRole: process.env.KEYCLOAK_CLIENT_ROLE,
    allowHttp:    process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});
```


## Intégration dans votre index.js ou autre point d'entré

- ### Pour Express
```javascript
/*
[....]
*/
const { middlewareSSO } = require('./middleware/sso_middleware');
/*
[....]
*/
app.use(middlewareSSO);
//Puis glissez en dessous les routes que vous souhaitez etre protéger ->
app.get('/info', (req, res) => {
    res.json({ message: 'ok'});
});
/*
[....]
*/

```

- ### Pour Fastify
```javascript
/*
[....]
*/
const ssoPlugin = require('./middleware/sso_middleware');
/*
[....]
*/
// Le plugin SSO expose /login, /callback, /backchannel-logout
// et protège toutes les autres routes automatiquement
await fastify.register(ssoPlugin);

// Déclarez vos routes protégées après l'enregistrement du plugin
fastify.get('/info', async (req, reply) => {
    return { message: 'ok' };
});
/*
[....]
*/
```