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
Chaque requête doit porter un header `Authorization: Bearer <token>`. Le module envoie ce token à l'endpoint d'introspection de Keycloak (`/token/introspect`) pour vérifier qu'il est actif. La validation se fait à chaque requête — aucun token révoqué ne peut donc passer entre les mailles.

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
│           Keycloak (API publique)        │
│  new Keycloak(driver, config)           │
│  kc.protect(app, routes, mode, roles)   │
└────────────────┬────────────────────────┘
                 │ orchestre
┌────────────────▼────────────────────────┐
│         HANDLERS (logique OIDC)         │
│  authCode.js  ·  introspection.js       │
│  backchannel.js                         │
└────────────────┬────────────────────────┘
                 │ traduit via
┌────────────────▼────────────────────────┐
│         ADAPTERS (traduction HTTP)      │
│  Adapter.js  ·  Drivers.js              │
└─────────────────────────────────────────┘
```

**Handlers** — Logique OIDC pure, agnostique au framework. Chaque handler reçoit un objet `ctx` neutre `{ session, headers, url, body }` et retourne une décision `{ type: 'allow' | 'redirect' | 'deny' | 'session', ... }`.

**Adapters** — Traduisent les objets `req`/`res` du framework en `ctx`, et les décisions en réponses HTTP (`res.redirect()`, `res.status(403).end()`, etc.). Un `Driver` par framework (EXPRESS, FASTIFY) définit comment faire cette traduction.

**Keycloak** — Orchestre le tout : fait la discovery OIDC, instancie les handlers, dispatche chaque requête vers la bonne stratégie d'auth selon les règles déclarées via `protect()`.

### Pattern Strategy

Les trois comportements OIDC sont encapsulés dans des objets interchangeables :

- `authorizationCode` — gère le flow navigateur (startLogin, handleCallback, authenticate)
- `introspection` — valide un Bearer token via l'endpoint d'introspection
- `backchannel` — reçoit les notifications de déconnexion de Keycloak

Chaque handler expose une interface contractuelle. `Keycloak` ne sait pas lequel il utilise — il appelle toujours `handler.authenticate(ctx)` et réagit à la décision retournée.

### Pattern Driver — extensibilité framework

Chaque framework est encapsulé dans un `Driver` qui implémente un contrat de 13 méthodes réparties en trois familles :

- **Traduction par requête** — `getSession`, `getHeaders`, `getBody`, `getUrl`, `getSessionId`, `setPrincipal`, `redirect`, `deny`, `ok`
- **Exécution** — `wrap(logic)` adapte la logique au modèle d'exécution du framework (middleware Express vs hook Fastify)
- **Setup** — `createStore()`, `mountSession()`, `mountAuthRoutes()`, `install()` gèrent l'initialisation côté framework

Pour supporter un nouveau framework (NestJS, Koa...), il suffit d'implémenter ces 13 méthodes dans une nouvelle classe qui étend `DriverContrat`. Aucune modification du cœur du module n'est nécessaire.

### Vérification des rôles par groupe de routes

Les rôles Keycloak requis sont déclarés **par règle de protection**, pas globalement. Cela permet de définir des niveaux d'accès différents sur une même application :

```js
kc.protect(app, '/admin/*', 'session', 'admin');               // rôle admin requis
kc.protect(app, '/reports', 'bearer',  ['admin', 'analyst']);  // plusieurs rôles
kc.protect(app, '/info',    'bearer');                         // authentifié, sans rôle requis
```

La vérification est faite par `Keycloak` après que le handler a authentifié le principal — les handlers eux-mêmes ne connaissent pas les rôles.

### Injection de dépendances

Le module n'embarque aucune dépendance framework. Express, express-session, @fastify/session, @fastify/cookie, @fastify/formbody sont portés par les drivers et résolus au moment du `require` — uniquement si le driver correspondant est utilisé. Cela évite d'installer des dépendances Fastify dans un projet Express, et inversement.

Les dépendances de test (`_client`, `_factories`, `fetch`) sont également injectables, ce qui permet de tester toute la logique métier sans jamais toucher Keycloak.

### Store de session avec reaper

Chaque driver crée son propre store de session via `createStore()`. Contrairement au `MemoryStore` par défaut d'express-session (qui fuit la mémoire), ce store embarque un **reaper** — un nettoyeur périodique qui détruit automatiquement les entrées dont le cookie a expiré. Le reaper tourne en arrière-plan sans bloquer l'arrêt du process (`timer.unref()`).

---

## Structure des fichiers

```
sso_keycloak/
├── src/
│   ├── index.js                  ← exporte { Keycloak, DRIVERS }
│   ├── Keycloak.js               ← classe principale, protect(), dispatcher
│   ├── core.js                   ← discovery OIDC, instanciation des handlers
│   ├── adapters/
│   │   ├── Adapter.js            ← guard, loginRoute, callbackRoute, backchannelRoute
│   │   ├── DriverContrat.js      ← classe abstraite — contrat des 13 méthodes
│   │   └── Drivers.js            ← ExpressDriver et FastifyDriver
│   └── handlers/
│       ├── authCode.js           ← Authorization Code + PKCE
│       ├── introspection.js      ← validation Bearer par introspection
│       └── backchannel.js        ← réception des logout Keycloak
└── test/
```

### Flux de données — mode session

```
Navigateur          Express/Fastify         sso_keycloak              Keycloak
    │                      │                     │                       │
    │── GET /page ────────>│                     │                       │
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
Point d'entrée unique. Exporte `Keycloak` (la classe principale) et `DRIVERS` (les drivers Express et Fastify).

### `src/Keycloak.js`
Classe principale du module. Le constructeur prend un `driver` et une `config`, lance la discovery OIDC en arrière-plan (`#ready`), et crée le store de session. La méthode `protect(app, routes, mode, roles)` enregistre une règle de protection et installe le handler correspondant sur l'app. Un dispatcher interne consulte les règles à chaque requête, sélectionne la première qui matche l'URL, vérifie les rôles si requis, et délègue à la bonne stratégie.

### `src/core.js`
Seule source de vérité pour la discovery OIDC. Appelle `openid-client` pour interroger le `.well-known/openid-configuration` de Keycloak, récupère les endpoints (`introspection_endpoint`, `jwks_uri`), puis instancie les trois handlers. Toutes les factories passent par ici — aucune ne duplique la discovery.

### `src/handlers/authCode.js`
Implémente le flow Authorization Code + PKCE. Génère le `code_verifier` et le `state`, construit l'URL de redirection Keycloak, échange le code contre les tokens au callback, extrait les rôles depuis le `access_token` (`resource_access[clientId].roles`), et stocke l'utilisateur en session.

### `src/handlers/introspection.js`
Extrait le Bearer token du header `Authorization`, POST vers l'endpoint d'introspection Keycloak avec les credentials client en Basic Auth, vérifie que `active === true` et retourne le principal avec ses rôles. La vérification du rôle requis est déléguée à `Keycloak`.

### `src/handlers/backchannel.js`
Reçoit le `logout_token` envoyé par Keycloak lors d'une déconnexion. Vérifie la signature JWT via JWKS (`jwks-rsa`), extrait le `sid` Keycloak, retrouve l'ID de session serveur dans la map interne, et détruit la session via `sessionStore.destroy()`. Maintient une `sessionMap` (keycloak_sid → session_id) alimentée par `trackSession()` au moment du login.

### `src/adapters/DriverContrat.js`
Classe abstraite qui définit le contrat des 13 méthodes qu'un driver doit implémenter. Chaque méthode non surchargée lève une erreur à l'exécution. Pour ajouter un nouveau framework, étendre cette classe suffit — aucune modification du reste du module n'est nécessaire.

### `src/adapters/Adapter.js` + `Drivers.js`
L'`Adapter` expose quatre méthodes — `guard`, `loginRoute`, `callbackRoute`, `backchannelRoute` — qui wrappent les handlers dans des fonctions framework-compatibles. `Drivers.js` contient `ExpressDriver` et `FastifyDriver`, deux classes qui étendent `DriverContrat` et encapsulent les différences d'API entre les deux frameworks.

---

## A lire également

- [Exemples d'implémentation dans votre application Node.js](./Example.md)
- [Sources OpenID Connect utilisées](./OpenID_sources.md)
- [Détail des stratégies](./Stratégie.md)

---

## Author

### Roty Clément