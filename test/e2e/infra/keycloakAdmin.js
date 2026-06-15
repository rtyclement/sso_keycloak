/**
 * Accès à l'API d'administration Keycloak : obtenir un jeton admin, retrouver un
 * utilisateur, et déconnecter ses sessions (ce qui déclenche le backchannel).
 */
const { axios, acceptAnyStatus, postForm } = require('../support/http');
const { assert } = require('../support/flow');
const { keycloak, users } = require('../config');

/** Jeton d'accès admin (realm master, client `admin-cli`, grant password). */
async function getAdminToken() {
    const res = await postForm(keycloak.masterTokenUrl, {
        grant_type: 'password',
        client_id:  'admin-cli',
        username:   users.admin.username,
        password:   users.admin.password,
    });
    assert(res.status === 200, res.status, `token admin Keycloak refusé: ${JSON.stringify(res.data)}`);
    return res.data.access_token;
}

/** En-tête d'autorisation Bearer prêt à l'emploi pour les appels admin. */
function adminAuth(token) {
    return { headers: { authorization: `Bearer ${token}` }, ...acceptAnyStatus };
}

/** Id Keycloak d'un utilisateur, recherché par username exact. */
async function findUserId(token, username) {
    const url = `${keycloak.adminRealmUrl}/users?username=${encodeURIComponent(username)}&exact=true`;
    const res = await axios.get(url, adminAuth(token));
    assert(res.status === 200 && res.data?.[0]?.id, res.status, `lookup admin du user '${username}' échoué`);
    return res.data[0].id;
}

/**
 * Déconnecte TOUTES les sessions Keycloak d'un utilisateur. Keycloak envoie alors
 * un logout_token backchannel à chaque client concerné. Renvoie le statut HTTP
 * (204 attendu) pour que l'appelant l'assertionne.
 */
async function logoutAllSessions(token, userId) {
    const res = await axios.post(`${keycloak.adminRealmUrl}/users/${userId}/logout`, null, adminAuth(token));
    return res.status;
}

module.exports = { getAdminToken, findUserId, logoutAllSessions };
