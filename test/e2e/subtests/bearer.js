/**
 * Sous-tests du mode BEARER : protection d'une API par token d'accès.
 * Le token est obtenu par password-grant (flux direct, sans navigateur).
 */
const { axios, acceptAnyStatus, postForm } = require('../support/http');
const { assert } = require('../support/flow');
const { app, keycloak, client, users } = require('../config');

/** Obtient un access token Keycloak par password-grant pour `user`. */
async function fetchAccessToken(user) {
    const res = await postForm(keycloak.tokenUrl, {
        grant_type:    'password',
        client_id:     client.id,
        client_secret: client.secret,
        username:      user.username,
        password:      user.password,
        scope:         'openid',
    });
    assert(res.status === 200, res.status, `password-grant (${user.username}) a échoué: ${JSON.stringify(res.data)}`);
    assert(!!res.data.access_token, 'ERR', 'access_token absent de la réponse token');
    return res.data.access_token;
}

/** GET /api/info avec un token donné (ou sans token si `token` est null). */
function getApiInfo(token) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    return axios.get(`${app.url}/api/info`, { headers, ...acceptAnyStatus });
}

/** Utilisateur AVEC le rôle api-access → 200 (+ rôle) ; et 401 sans token. */
async function bearerAllowSubtest() {
    const token = await fetchAccessToken(users.withAccess);

    const withToken = await getApiInfo(token);
    assert(withToken.status === 200, withToken.status, `GET /api/info attendu 200, reçu ${withToken.status}`);
    assert(withToken.data?.message === 'ok', 'ERR', `corps inattendu: ${JSON.stringify(withToken.data)}`);
    assert((withToken.data?.user?.roles || []).includes('api-access'), 'ERR',
        `rôle 'api-access' absent du principal: ${JSON.stringify(withToken.data?.user?.roles)}`);

    const noToken = await getApiInfo(null);
    assert(noToken.status === 401, noToken.status, `GET /api/info sans token attendu 401, reçu ${noToken.status}`);

    return 'token OK, /api/info 200 + rôle api-access, 401 sans token';
}

/** Utilisateur authentifié SANS le rôle api-access → 403. */
async function bearerDenySubtest() {
    const token = await fetchAccessToken(users.withoutAccess);
    const res   = await getApiInfo(token);
    assert(res.status === 403, res.status,
        `GET /api/info (token valide mais rôle insuffisant) attendu 403, reçu ${res.status}`);
    return 'token valide, rôle insuffisant → 403';
}

module.exports = { bearerAllowSubtest, bearerDenySubtest };
