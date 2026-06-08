# Stratégie de l'adaptateur : 

## authorizationCode reçoit :

### *Objectif* : c'est la branche navigateur. Un humain ouvre son browser, l'app le redirige vers la page de login de Keycloak, il y entre son login et son mot de passe, Keycloak le renvoie vers l'app avec un code, et la stratégie échange ce code contre un token. L'utilisateur ne tape jamais ses credentials dans l'application — il les tape sur la page de Keycloak. C'est le flux "login/mdp", mais délégué entièrement à Keycloak.

- `client` et `config` — parce que la stratégie va appeler les fonctions d'openid-client (`buildAuthorizationUrl`, `authorizationCodeGrant`). Ces fonctions prennent le `config` issu de la discovery en premier argument. Sans eux, impossible d'interagir avec Keycloak. Source : API openid-client v6.
- `redirectUri` — c'est une exigence de la spec OIDC : quand tu rediriges l'utilisateur vers Keycloak pour qu'il se connecte, tu dois lui dire où le renvoyer après. Cette URL doit être enregistrée dans la config du client Keycloak. Source : OpenID Connect Core 1.0, section Authorization Endpoint.
- `sessionStore` — la stratégie authCode gère une session : elle y stocke le `code_verifier` (PKCE) avant la redirection, et l'identité de l'utilisateur après le callback. Elle a besoin du store pour lire et écrire. Source : besoin applicatif, PKCE défini dans RFC 7636.
- `clientId` et `requiredRole` — pour vérifier les rôles après connexion. Dans un token Keycloak, les rôles sont imbriqués sous `resource_access[clientId].roles`. Sans le `clientId`, on ne sait pas où chercher. Source : structure du JWT Keycloak.

## introspection reçoit :

### *Objectif* : C'est la branche API. Aucun humain, aucun navigateur, aucune redirection. Un client HTTP (Bruno, Podman, ou une API (API TIERS)) envoie une requête avec un token dans le header `Authorization: Bearer`. La stratégie prend ce token, l'envoie à Keycloak pour vérifier qu'il est toujours actif, et rend sa décision.

`introspectUrl` — l'endpoint Keycloak auquel on envoie le token pour savoir s'il est actif. Extrait des métadonnées de discovery (metadata.introspection_endpoint), jamais codé en dur. Source : OpenID Connect Discovery 1.0.
`clientId` et `clientSecret` — Keycloak n'accepte pas n'importe qui sur son endpoint d'introspection. Il faut s'authentifier en tant que client confidentiel (Basic Auth). Sans ces credentials, Keycloak répond 401. Source : RFC 7662, section 2.1.
`audienceClientId` — c'est le client dont on veut vérifier les rôles dans la réponse d'introspection. Ce n'est pas forcément le même client que celui qui s'authentifie pour introspecter. Source : structure du JWT Keycloak, `resource_access`.
`requiredRole` — même logique que pour authCode.

## backchannel reçoit :

### *Objectif* : Permettre la création d'un tunnel HTTP entre le serveur Keycloak et l'application pour avoir des mise à jour d'état instantané. C'est ce qui permet de faire de la révocation de token, et de session depuis le dashboard Admin de Keycloak et que le client applicatif se mettre à jour et couper l'acces à l'utilisateur.

`sessionStore` — pour détruire la session quand Keycloak envoie un logout. C'est l'action centrale du backchannel logout. Source : OpenID Connect Back-Channel Logout 1.0.
`jwksUri` — le backchannel reçoit un `logout_token` signé par Keycloak. Avant de détruire la session, il faut vérifier cette signature contre les clés publiques de Keycloak. L'URI JWKS est aussi dans les métadonnées. Source : RFC 9240, OpenID Connect Discovery.