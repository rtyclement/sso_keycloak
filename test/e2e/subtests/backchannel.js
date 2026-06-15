/**
 * Sous-test du BACKCHANNEL LOGOUT (OIDC).
 * Login session → on déconnecte l'utilisateur côté Keycloak (admin API) →
 * Keycloak POSTe un logout_token sur /backchannel-logout → la session app doit
 * être révoquée (/dashboard repasse de 200 à 302).
 */
const { assert, pollUntil } = require('../support/flow');
const { app, users } = require('../config');
const { loginViaBrowser } = require('./session');
const { getAdminToken, findUserId, logoutAllSessions } = require('../infra/keycloakAdmin');

const MAX_ATTEMPTS    = 2;
const REVOKE_TIMEOUT  = 6_000;

async function backchannelLogoutSubtest() {
    const adminToken = await getAdminToken();
    const userId     = await findUserId(adminToken, users.withAccess.username);

    // Jusqu'à 2 tentatives — artefact du banc, PAS un défaut de la lib :
    // Express puis Fastify écoutent tour à tour sur le MÊME port. Après le
    // passage à Fastify, le premier POST backchannel de Keycloak peut tomber sur
    // une connexion keep-alive restée ouverte vers le process Express désormais
    // mort (NoHttpResponse), et Keycloak ne retente pas un POST. Ce premier échec
    // purge la connexion ; la tentative suivante repart sur une connexion neuve.
    // (En production, les logouts sont espacés : Keycloak revalide la connexion
    // avant de la réemployer.)
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { get } = await loginViaBrowser(users.withAccess);

        const before = await get(`${app.url}/dashboard`);
        assert(before.status === 200, before.status, `pré-condition /dashboard attendu 200, reçu ${before.status}`);

        const logoutStatus = await logoutAllSessions(adminToken, userId);
        assert(logoutStatus === 204, logoutStatus, `POST /users/{id}/logout attendu 204, reçu ${logoutStatus}`);

        try {
            await pollUntil('révocation de la session via backchannel', async () => {
                const res = await get(`${app.url}/dashboard`);
                return res.status === 302;
            }, { timeoutMs: REVOKE_TIMEOUT, intervalMs: 500 });

            const retry = attempt > 1 ? ` (tentative ${attempt})` : '';
            return `logout Keycloak → logout_token reçu → session app révoquée (302 /dashboard)${retry}`;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}

module.exports = { backchannelLogoutSubtest };
