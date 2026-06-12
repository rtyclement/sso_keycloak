# test_sso_keycloak — tests end-to-end locaux

Banc de test e2e **100 % local** du package [`sso_keycloak`](../sso_keycloak). Démarre un
vrai serveur Keycloak (Docker), lance tour à tour un serveur Express puis Fastify,
et exerce les deux modes d'authentification via de vraies requêtes HTTP.

## Lancer

```bash
npm install
npm test           # docker compose up → tests → laisse Keycloak lancé
npm run test:down  # idem mais `docker compose down` à la fin
```

Prérequis : **Docker Desktop démarré** et **Node 18+**.

## Ce qui est testé

Le runner [e2e.js](e2e.js) orchestre, pour **chaque** framework (un serveur à la fois) :

| Sous-test | Déroulé | Attendu |
|---|---|---|
| **bearer**  | password-grant Keycloak → access token → `GET /api/info` avec `Authorization: Bearer` ; puis sans token | 200 + rôle `api-access`, et 401 sans token |
| **session** | `GET /dashboard` → 302 `/login` → page Keycloak (scrapée) → POST identifiants → `/callback` → `GET /dashboard` avec cookie | 200 + rôle `dashboard-access` |

Sortie finale : deux verdicts `VALIDE` / `INVALIDE` avec le code de chaque sous-test.
Code de sortie ≠ 0 si un sous-test échoue.

```
┌──────────────────────────── RÉSULTATS ────────────────────────────
│ EXPRESS  → VALIDE     (bearer:ok  session:ok)
│ FASTIFY  → VALIDE     (bearer:ok  session:ok)
└───────────────────────────────────────────────────────────────────
```

## Architecture

- **Keycloak en Docker**, serveurs Node + runner **sur l'hôte** → aucune complexité
  réseau Docker, le port 8080 (Keycloak) et 9090 (app) sont exposés en `localhost`.
- Le realm est **importé au démarrage** depuis [keycloak/realm-export.json](keycloak/realm-export.json)
  (client confidentiel `test-client`, rôles `dashboard-access` / `api-access`,
  user `testuser` / `testpassword`) — aucune config manuelle.
- Chaque serveur ([server_express.js](server_express.js), [server_fastify.js](server_fastify.js))
  monte **les deux modes sur un port unique** : `/api/*` en bearer, le reste en session.

## Fichiers

| Fichier | Rôle |
|---|---|
| [docker-compose.yml](docker-compose.yml) | Keycloak 26.1 + import realm + healthcheck |
| [keycloak/realm-export.json](keycloak/realm-export.json) | realm de test importé |
| [.env](.env) | configuration (URLs, secret, identifiants de test) |
| [middleware/](middleware/) | instanciation `Keycloak` (express / fastify) |
| [server_express.js](server_express.js) / [server_fastify.js](server_fastify.js) | serveurs sous test |
| [e2e.js](e2e.js) | orchestrateur de test |

## Notes (pièges rencontrés)

- Keycloak pose ses cookies de session en `SameSite=None` (donc `Secure`). Le client
  de test ignore volontairement le flag `Secure` pour pouvoir les renvoyer en HTTP local.
- Le mode session exige que `KEYCLOAK_REDIRECT_URI` pointe **exactement** sur le port
  du serveur (`APP_PORT`), sinon l'échange code→token est rejeté par Keycloak.
