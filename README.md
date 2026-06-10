# sso_keycloak

Module Node.js interne de protection d'applications et d'APIs via Keycloak. Il remplace `keycloak-connect` (officiellement déprécié) en s'appuyant sur `openid-client` v6 — la bibliothèque de référence recommandée par la spécification OpenID Connect.

---

## Pourquoi ce module existe

`keycloak-connect`, l'ancien adaptateur officiel Keycloak pour Node.js, est déprécié. Il couplait fortement la logique d'authentification au framework Express et ne supportait pas les standards OIDC modernes (PKCE, backchannel logout RFC 7009, introspection RFC 7662).

`sso_keycloak` répond à trois besoins concrets :

- **Protéger une application web** avec un flow login/mot de passe complet (Authorization Code + PKCE, sessions serveur, déconnexion temps réel via backchannel logout).
- **Protéger une API REST** en validant les Bearer tokens via introspection Keycloak à chaque requête — ce qui garantit la révocation immédiate contrairement à la validation JWT locale.
- **Rester réutilisable** sur plusieurs projets sans dupliquer la logique d'authentification ni imposer de dépendances framework.

---

## Ce que fait le module

### Deux modes d'authentification

**Mode session (flow navigateur)**
L'utilisateur est redirigé vers Keycloak, s'authentifie avec son login/mot de passe, et revient sur l'application via un callback. Les tokens ne transitent jamais côté navigateur — ils sont stockés en session serveur (pattern BFF). Quand l'utilisateur se déconnecte de Keycloak (ou qu'un administrateur révoque sa session), le module reçoit un appel backchannel de Keycloak et détruit la session serveur immédiatement.

**Mode bearer (flow API)**
Chaque requête doit porter un header `Authorization: Bearer <token>`. Le module envoie ce token à l'endpoint d'introspection de Keycloak (`/token/introspect`) pour vérifier qu'il est actif et que le porteur possède le rôle requis. La validation se fait à chaque requête — aucun token révoqué ne peut donc passer entre les mailles.

### Frameworks supportés

| Mode | Express | Fastify |
|---|---|---|
| Session (navigateur) | ✅ | ✅ |
| Bearer (API) | ✅ | ✅ |

---

## Comment il le fait — les patterns utilisés

### Architecture hexagonale (ports & adaptateurs)

Le module est structuré en trois couches qui ne se connaissent pas mutuellement :

```
┌─────────────────────────────────────────┐
│           FACTORIES (câblage)           │
│  express.js / fastify.js / *-bearer.js  │
│  core.js                                │
└────────────────┬────────────────────────┘
                 │ instancie
┌────────────────▼────────────────────────┐
│         STRATEGIES (logique OIDC)       │
│  authCode.js  ·  introspection.js       │
│  backchannel.js                         │
└────────────────┬────────────────────────┘
                 │ traduit via
┌────────────────▼────────────────────────┐
│         ADAPTERS (traduction HTTP)      │
│  Adapter.js  ·  Drivers.js              │
└─────────────────────────────────────────┘
```

**Strategies** — Logique OIDC pure, agnostique au framework. Chaque stratégie reçoit un objet `ctx` neutre `{ session, headers, url, body }` et retourne une décision `{ type: 'allow' | 'redirect' | 'deny' | 'session', ... }`.

**Adapters** — Traduisent les objets `req`/`res` du framework en `ctx`, et les décisions en réponses HTTP (`res.redirect()`, `res.status(403).end()`, etc.). Un `Driver` par framework (EXPRESS, FASTIFY) définit comment faire cette traduction.

**Factories** — Assemblent le tout : font la discovery OIDC, instancient les stratégies, enregistrent les routes et hooks, et retournent un router Express ou un plugin Fastify prêt à l'emploi.

### Pattern Strategy

Les trois comportements OIDC sont encapsulés dans des objets interchangeables :

- `authorizationCode` — gère le flow navigateur (startLogin, handleCallback, authenticate)
- `introspection` — valide un Bearer token via l'endpoint d'introspection
- `backchannel` — reçoit les notifications de déconnexion de Keycloak

Chaque stratégie expose une interface contractuelle. L'`Adapter` ne sait pas quelle stratégie il utilise — il appelle toujours `strategy.authenticate(ctx)` et réagit à la décision retournée.

### Injection de dépendances

Le module n'embarque aucune dépendance framework. Express, express-session, @fastify/session, @fastify/cookie, @fastify/formbody sont tous **injectés par le consommateur**. Cela évite les conflits de versions (deux instances d'express-session dans le même projet), allège le module, et rend chaque composant testable sans réseau ni framework réel.

Les dépendances de test (`_client`, `_factories`, `fetch`) sont également injectables, ce qui permet de tester toute la logique métier sans jamais toucher Keycloak.

---

## Structure des fichiers

```
sso_keycloak/
├── src/
│   ├── index.js                  
│   ├── adapters/
│   │   ├── Adapter.js            
│   │   └── Drivers.js            
│   ├── factories/
│   │   ├── core.js               
│   │   ├── express/
│   │   │   ├── express.js        
│   │   │   └── express-bearer.js 
│   │   └── fastify/
│   │       ├── fastify.js        
│   │       └── fastify-bearer.js 
│   └── strategies/
│       ├── authCode.js           
│       ├── introspection.js      
│       └── backchannel.js        
└── test/                        
```

### Flux de données — mode session

```
Navigateur          Express/Fastify         sso_keycloak              Keycloak
    │                      │                     │                       │
    │── GET /page ───────> │                     │                       │
    │                      │── authenticate ────>│                       │
    │                      │<─ redirect /login ──│                       │
    │<─ 302 /login ────────│                     │                       │
    │                      │                     │                       │
    │── GET /login ───────>│                     │                       │
    │                      │── startLogin ──────>│                       │
    │<─ 302 Keycloak ──────│<─ redirect kc_url ──│                       │
    │                      │                     │                       │
    │── POST login ─────────────────────────────────────────────────────>│
    │<─ 302 /callback?code= ─────────────────────────────────────────────│
    │                      │                     │                       │
    │── GET /callback ────>│                     │                       │
    │                      │── handleCallback ──>│                       │
    │                      │                     │── token exchange ────>│
    │                      │                     │<─ access_token ───────│
    │                      │<─ session { user } ─│                       │
    │<─ 302 / ─────────────│                     │                       │
    │                      │                     │                       │
    │                      │<─ POST /backchannel-logout ─────────────────│ (logout admin)
    │                      │── handle ──────────>│                       │
    │                      │                     │── destroy session     │
```

### Flux de données — mode bearer

```
Client API          Express/Fastify         sso_keycloak              Keycloak
    │                      │                     │                       │
    │── GET /info ────────>│                     │                       │
    │   Authorization:     │── authenticate ────>│                       │
    │   Bearer <token>     │                     │── POST /introspect ──>│
    │                      │                     │   token=<token>       │
    │                      │                     │<─ { active: true }────│
    │                      │<─ allow ────────────│                       │
    │<─ 200 { data } ──────│                     │                       │
```

---

## Responsabilités de chaque fichier clé

### `src/index.js`
Point d'entrée unique. Dispatch vers la bonne factory selon les dépendances injectées et la config :
- `config.framework === 'fastify'` + `deps.session` → `fastify.js`
- `config.framework === 'fastify'` → `fastify-bearer.js`
- `deps.express` + `deps.session` → `express.js`
- `deps.express` → `express-bearer.js`

### `src/factories/core.js`
Seule source de vérité pour la discovery OIDC. Appelle `openid-client` pour interroger le `.well-known/openid-configuration` de Keycloak, récupère les endpoints (`introspection_endpoint`, `jwks_uri`), puis instancie les trois stratégies. Toutes les factories passent par ici — aucune ne duplique la discovery.

### `src/strategies/authCode.js`
Implémente le flow Authorization Code + PKCE. Génère le `code_verifier` et le `state`, construit l'URL de redirection Keycloak, échange le code contre les tokens au callback, extrait les rôles depuis le `access_token` (`resource_access[clientId].roles`), et stocke l'utilisateur en session.

### `src/strategies/introspection.js`
Extrait le Bearer token du header `Authorization`, POST vers l'endpoint d'introspection Keycloak avec les credentials client en Basic Auth, vérifie que `active === true` et que le rôle requis est présent dans `resource_access[clientId].roles`.

### `src/strategies/backchannel.js`
Reçoit le `logout_token` envoyé par Keycloak lors d'une déconnexion. Vérifie la signature JWT via JWKS (`jwks-rsa`), extrait le `sid` Keycloak, retrouve l'ID de session serveur dans la map interne, et détruit la session via `sessionStore.destroy()`. Maintient une `sessionMap` (keycloak_sid → session_id) alimentée par `trackSession()` au moment du login.

### `src/adapters/Adapter.js` + `Drivers.js`
L'`Adapter` expose quatre méthodes — `guard`, `loginRoute`, `callbackRoute`, `backchannelRoute` — qui wrappent les stratégies dans des handlers framework. Chaque méthode délègue les opérations HTTP à un `Driver`. `Drivers.js` contient deux drivers gelés (`EXPRESS`, `FASTIFY`) qui encapsulent les différences d'API entre les deux frameworks (`req.sessionID` vs `req.session.sessionId`, `res.status().end()` vs `reply.code().send()`, etc.).


## A lire également : 

- [Liste des 4 examples d'implementation dans votre application NodeJs](./Example.md)

- [Source utlisé et documenté de OpenID](./OpenID_sources.md)

- [Détaille des Stratégies utilisés](./Stratégie.md)

## Author :

### Roty Clément