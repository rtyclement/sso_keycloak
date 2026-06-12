# Sources externes — OpenID Connect & openid-client

Ce document recense tous les points d'appui externes du module : les parties de la spécification OpenID Connect utilisées, les fonctions et objets propres à `openid-client` v6, et les bibliothèques tierces. L'objectif est d'identifier rapidement ce qui ne dépend pas du code interne — et donc ce qui peut changer sans que le module en soit responsable.

---

## 1. Spécifications OpenID Connect / OAuth2 utilisées

### RFC 6749 — OAuth 2.0 Authorization Framework
Socle du flow Authorization Code. Définit le cycle code → token exchange.
- Endpoint utilisé : `authorization_endpoint` (redirection initiale vers Keycloak)
- Endpoint utilisé : `token_endpoint` (échange du code contre les tokens)

### RFC 7636 — PKCE (Proof Key for Code Exchange)
Extension de sécurité du flow Authorization Code. Protège contre l'interception du code.
- `code_verifier` — chaîne aléatoire générée côté client
- `code_challenge` — hash SHA-256 du verifier (`S256`)
- Paramètres ajoutés à la requête d'autorisation : `code_challenge`, `code_challenge_method`
- Paramètre ajouté à l'échange token : `code_verifier`

### RFC 7009 — Token Revocation
Endpoint de révocation de tokens.
- Endpoint utilisé : `revocation_endpoint`
- Paramètres : `token`, `token_type_hint` (`access_token` ou `refresh_token`), credentials client

### RFC 7662 — Token Introspection
Validation des Bearer tokens côté serveur. Permet la révocation immédiate contrairement à la validation JWT locale.
- Endpoint utilisé : `introspection_endpoint`
- Méthode : POST avec Basic Auth (`client_id:client_secret`)
- Paramètre : `token`
- Champs de la réponse utilisés :
  - `active` (boolean) — le token est-il valide et non révoqué
  - `resource_access[clientId].roles` — rôles de l'utilisateur pour ce client
  - `sid` — identifiant de session Keycloak (utilisé pour le backchannel)

### OpenID Connect Core 1.0
Extension d'OAuth2 ajoutant l'identité utilisateur.
- Discovery : `GET /.well-known/openid-configuration` — retourne tous les endpoints
- `id_token` — JWT contenant les claims utilisateur
- Champs utilisés dans l'access_token (via `jwt.decode`) :
  - `resource_access[clientId].roles` — rôles pour le client concerné
  - `sid` — session ID Keycloak (lié au backchannel logout)

### OpenID Connect Back-Channel Logout 1.0
Mécanisme de déconnexion serveur-à-serveur. Keycloak appelle l'endpoint `/backchannel-logout` de l'application.
- `logout_token` — JWT signé par Keycloak envoyé en POST `application/x-www-form-urlencoded`
- Claims du logout_token utilisés :
  - `events["http://schemas.openid.net/event/backchannel-logout"]` — présence obligatoire
  - `sid` — session Keycloak à invalider
- Vérification de signature via JWKS (`jwks_uri`)

---

## 2. `openid-client` v6 (panva)

Bibliothèque Node.js implémentant le rôle de Relying Party OIDC.
**Version utilisée : v6.x** — attention, l'API est radicalement différente de v5.

### Discovery

```js
const config = await client.discovery(issuerUrl, clientId, clientSecret, undefined, options);
```

| Paramètre | Type | Rôle |
|---|---|---|
| `issuerUrl` | `URL` | URL de base du realm Keycloak |
| `clientId` | `string` | Identifiant du client OIDC |
| `clientSecret` | `string` | Secret du client (confidential client) |
| `undefined` | — | 4ème paramètre réservé |
| `options` | `object` | Options supplémentaires (voir ci-dessous) |

**Option HTTP non sécurisé** — nécessaire pour Keycloak en HTTP (développement) :
```js
{ execute: [client.allowInsecureRequests] }
```
Sans cette option, openid-client v6 rejette toute discovery vers un endpoint HTTP avec `OAUTH_HTTP_REQUEST_FORBIDDEN`.

Retourne un objet `config` (ServerMetadata) dont on extrait les endpoints :
```js
const metadata = config.serverMetadata();
metadata.introspection_endpoint  // URL d'introspection
metadata.jwks_uri                // URL des clés publiques JWKS
```

### PKCE — génération des paramètres

```js
const codeVerifier    = client.randomPKCECodeVerifier();
const codeChallenge   = await client.calculatePKCECodeChallenge(codeVerifier);
const state           = client.randomState();
```

### Construction de l'URL d'autorisation

```js
const url = client.buildAuthorizationUrl(config, {
    redirect_uri:          redirectUri,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
    state,
});
```

Retourne un objet `URL`.

### Échange du code (callback)

```js
const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState:    state,
});
```

| Paramètre | Type | Rôle |
|---|---|---|
| `config` | ServerMetadata | Résultat de la discovery |
| `callbackUrl` | `URL` | URL complète du callback (avec `?code=...&state=...`) |
| `pkceCodeVerifier` | `string` | Verifier PKCE stocké en session |
| `expectedState` | `string` | State stocké en session |

**Point critique** : `callbackUrl` doit être un objet `URL` avec les search params dans l'URL elle-même — ils ne peuvent pas être passés séparément (comportement openid-client v6, différent de v5).

Retourne un objet `tokens` :
```js
tokens.access_token   // JWT d'accès
tokens.id_token       // JWT d'identité
tokens.refresh_token  // Token de rafraîchissement (si présent)
```

---

## 3. `jsonwebtoken`

Utilisé pour décoder/vérifier les JWTs localement.

```js
const jwt = require('jsonwebtoken');

// Décodage sans vérification (access_token pour extraire les rôles)
const decoded = jwt.decode(access_token);

// Vérification avec clé asymétrique (logout_token du backchannel)
jwt.verify(logoutToken, getSigningKey, { algorithms: ['RS256', 'ES256'] }, callback);
```

Champs extraits de l'access_token décodé :
- `decoded.resource_access[clientId].roles` — tableau des rôles

---

## 4. `jwks-rsa`

Récupère les clés publiques depuis l'endpoint JWKS de Keycloak pour vérifier la signature des logout_tokens.

```js
const jwksClient = jwks({
    jwksUri: metadata.jwks_uri,  // fourni par la discovery
});

function getSigningKey(header, callback) {
    jwksClient.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
}
```

Utilisé uniquement dans `backchannel.js` pour la vérification du `logout_token`.

---

## 5. Points de variation externe

Ces éléments sont hors du contrôle du module et peuvent nécessiter une mise à jour si Keycloak ou les specs changent.

| Point | Localisation dans le code | Risque de changement |
|---|---|---|
| `resource_access[clientId].roles` | `authCode.js`, `introspection.js` | Structure propre à Keycloak — peut varier selon la version ou la config des mappers |
| `events["http://schemas.openid.net/event/backchannel-logout"]` | `backchannel.js` | Défini par la spec OpenID Back-Channel Logout — stable |
| `sid` claim | `authCode.js`, `backchannel.js` | Claim Keycloak — doit être activé dans la config du realm |
| `client.allowInsecureRequests` | `core.js` | API interne d'openid-client v6 — peut changer en v7 |
| `client.discovery()` signature | `core.js` | API openid-client v6 — breaking change probable en v7 |
| `client.authorizationCodeGrant()` | `authCode.js` | Remplace `client.callback()` de v5 — vérifier en cas de mise à jour |
| `metadata.introspection_endpoint` | `core.js` → `introspection.js` | Standard OIDC Discovery — stable |
| `metadata.jwks_uri` | `core.js` → `backchannel.js` | Standard OIDC Discovery — stable |

---

## 6. Endpoints Keycloak utilisés

Tous sont découverts dynamiquement via `/.well-known/openid-configuration` — aucune URL n'est codée en dur dans le module.

| Endpoint | Source | Utilisation |
|---|---|---|
| `authorization_endpoint` | Discovery | Redirection login |
| `token_endpoint` | Discovery (via openid-client) | Échange code → tokens |
| `introspection_endpoint` | `metadata.introspection_endpoint` | Validation Bearer |
| `jwks_uri` | `metadata.jwks_uri` | Vérification signature logout_token |
| `revocation_endpoint` | Discovery | Révocation manuelle (hors module) |

L'URL de backchannel logout (`/backchannel-logout`) est à l'inverse un endpoint **exposé par le module** — c'est l'application qui le fournit à Keycloak dans la configuration du client.
