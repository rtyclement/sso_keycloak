# Stratégies OIDC et OAuth2

Les trois stratégies constituent le cœur métier du module. Elles sont agnostiques au framework — elles reçoivent un `ctx` neutre et retournent une décision. C'est `Keycloak` qui les orchestre et traduit ces décisions en réponses HTTP via le driver.

---

## `authorizationCode`

### Objectif

C'est la branche navigateur. Un humain ouvre son browser, l'application le redirige vers la page de login de Keycloak, il y entre son login et son mot de passe, Keycloak le renvoie vers l'application avec un code, et la stratégie échange ce code contre un token. L'utilisateur ne tape jamais ses credentials dans l'application — il les tape sur la page Keycloak. C'est le flux login/mot de passe, délégué entièrement à Keycloak.

### Ce qu'elle reçoit et pourquoi

**`client` et `config`** — la stratégie appelle les fonctions d'openid-client (`buildAuthorizationUrl`, `authorizationCodeGrant`). Ces fonctions prennent le `config` issu de la discovery en premier argument. Sans eux, impossible d'interagir avec Keycloak.
*Source : API openid-client v6.*

**`redirectUri`** — exigence de la spec OIDC : quand l'utilisateur est redirigé vers Keycloak pour s'authentifier, il faut indiquer où le renvoyer après. Cette URL doit être enregistrée dans la configuration du client Keycloak.
*Source : OpenID Connect Core 1.0, section Authorization Endpoint.*

**`sessionStore`** — la stratégie authCode gère une session : elle y stocke le `code_verifier` (PKCE) avant la redirection, et l'identité de l'utilisateur après le callback.
*Source : besoin applicatif, PKCE défini dans RFC 7636.*

**`clientId`** — après connexion, les rôles de l'utilisateur sont extraits du token. Dans un token Keycloak, ils sont imbriqués sous `resource_access[clientId].roles`. Sans le `clientId`, on ne sait pas où les chercher.
*Source : structure du JWT Keycloak.*

### Ce qu'elle expose

- `authenticate(ctx)` — vérifie si `session.user` existe. Si non, retourne `redirect /login`. Si oui, retourne `allow` avec le principal.
- `startLogin(ctx)` — génère le `code_verifier` et le `state` (PKCE), construit l'URL d'autorisation Keycloak, stocke le PKCE en session, retourne `redirect <keycloak_url>`.
- `handleCallback(ctx)` — échange le code contre les tokens via `authorizationCodeGrant`, décode l'`access_token`, extrait les rôles, stocke l'utilisateur en session, retourne `session`.

---

## `introspection`

### Objectif

C'est la branche API. Aucun humain, aucun navigateur, aucune redirection. Un client HTTP (Bruno, Postman, cURL, ou une autre API) envoie une requête avec un token dans le header `Authorization: Bearer <token>`. La stratégie prend ce token, l'envoie à Keycloak pour vérifier qu'il est toujours actif, et rend sa décision. Contrairement à la validation JWT locale, l'introspection interroge Keycloak à chaque requête — un token révoqué est donc refusé immédiatement.

### Ce qu'elle reçoit et pourquoi

**`introspectUrl`** — l'endpoint Keycloak auquel le token est envoyé pour savoir s'il est actif. Extrait des métadonnées de discovery (`metadata.introspection_endpoint`), jamais codé en dur.
*Source : OpenID Connect Discovery 1.0.*

**`clientId` et `clientSecret`** — Keycloak n'accepte pas n'importe qui sur son endpoint d'introspection. Il faut s'authentifier en tant que client confidentiel via Basic Auth. Sans ces credentials, Keycloak répond 401.
*Source : RFC 7662, section 2.1.*

**`audienceClientId`** — le client dont on veut vérifier les rôles dans la réponse d'introspection. Ce n'est pas nécessairement le même client que celui qui s'authentifie pour introspecter.
*Source : structure du JWT Keycloak, champ `resource_access`.*

### Ce qu'elle expose

- `authenticate(ctx)` — extrait le Bearer token du header, POST vers `introspectUrl` avec les credentials en Basic Auth, vérifie `active === true`, retourne `allow` avec le principal (incluant ses rôles) ou `deny 401`.

> La vérification du rôle requis n'est **pas** dans la stratégie — elle est déléguée à `Keycloak.protect()` qui dispose du contexte de la règle matchée (`match.roles`).

---

## `backchannel`

### Objectif

Permettre un tunnel HTTP entre Keycloak et l'application pour des mises à jour d'état instantanées. C'est ce qui permet la révocation de session depuis le dashboard admin de Keycloak : quand un administrateur déconnecte un utilisateur, Keycloak appelle l'endpoint `/backchannel-logout` de l'application, qui détruit la session serveur correspondante et coupe l'accès immédiatement — sans attendre l'expiration du token.

### Ce qu'elle reçoit et pourquoi

**`sessionStore`** — pour détruire la session quand Keycloak envoie un logout. C'est l'action centrale du backchannel logout : `sessionStore.destroy(sessionId, cb)`.
*Source : OpenID Connect Back-Channel Logout 1.0.*

**`jwksUri`** — le backchannel reçoit un `logout_token` signé par Keycloak. Avant de détruire la session, il faut vérifier cette signature contre les clés publiques de Keycloak. L'URI JWKS est extrait des métadonnées de discovery.
*Source : RFC 9240, OpenID Connect Discovery 1.0.*

### Ce qu'elle expose

- `handle(ctx)` — valide le `logout_token` (signature JWKS + présence du claim `events["http://schemas.openid.net/event/backchannel-logout"]` + `sid`), retrouve l'ID de session serveur via la `sessionMap` interne, détruit la session, retourne `{ status: 200 }` ou `{ status: 400, reason }`.
- `trackSession(keycloakSid, sessionId)` — appelé au moment du login pour alimenter la `sessionMap` (`keycloak_sid → session_id`). Sans ce mapping, le backchannel ne saurait pas quelle session serveur détruire quand Keycloak envoie un `sid`.

---

## Relation entre les trois stratégies

```
Login              authorizationCode.startLogin()     → redirect Keycloak
Callback           authorizationCode.handleCallback() → session { user }
                       └─ trackSession(sid, sessionId)
Requête gardée     authorizationCode.authenticate()   → allow | redirect
                   introspection.authenticate()        → allow | deny
Logout Keycloak    backchannel.handle()               → destroy session
```

La `sessionMap` du backchannel est le seul état partagé entre les stratégies — elle est alimentée par `handleCallback` et consommée par `handle`.