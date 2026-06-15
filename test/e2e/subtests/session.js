/**
 * Sous-tests du mode SESSION : protection par cookie de session, via le flux de
 * login navigateur (Authorization Code + PKCE) joué de bout en bout en HTTP.
 */
const { assert } = require('../support/flow');
const { createBrowserClient } = require('../support/cookieClient');
const { app, users } = require('../config');

/** Résout `location` (relatif ou absolu) par rapport à `base`. */
const resolveUrl = (base, location) => new URL(location, base).href;

/** Extrait l'URL d'action du formulaire de login Keycloak depuis le HTML. */
function extractLoginFormAction(html) {
    const match = String(html).match(/action="([^"]*login-actions\/authenticate[^"]*)"/i);
    return match ? match[1].replace(/&amp;/g, '&') : null;
}

/**
 * Déroule le flux de login navigateur complet et renvoie un client authentifié
 * (porteur du cookie de session app). Ne vérifie PAS les rôles — c'est le rôle
 * des sous-tests appelants.
 *
 *   A. GET /dashboard      → 302 vers /login (route protégée, non authentifié)
 *   B. GET /login          → 302 vers l'URL d'autorisation Keycloak
 *   C. suit les 30x        → page de login Keycloak (200 + formulaire)
 *   D. POST identifiants    → 302 vers le redirect_uri (/callback)
 *   E. GET /callback       → échange du code, pose la session, 302 vers /
 *
 * @returns {Promise<{ get: (url: string) => Promise<import('axios').AxiosResponse> }>}
 */
async function loginViaBrowser({ username, password }) {
    const client = createBrowserClient();
    const get = (url) => client.get(url);

    // (A) route protégée → redirection vers /login
    let res = await get(`${app.url}/dashboard`);
    assert(res.status === 302, res.status, `GET /dashboard attendu 302→/login, reçu ${res.status}`);
    assert(String(res.headers.location).includes('/login'), res.status,
        `redirection inattendue: ${res.headers.location}`);

    // (B) /login → redirection vers Keycloak
    res = await get(`${app.url}/login`);
    assert(res.status === 302, res.status, `GET /login attendu 302→Keycloak, reçu ${res.status}`);
    let keycloakUrl = resolveUrl(app.url, res.headers.location);
    assert(new URL(keycloakUrl).host !== app.host, res.status, `/login ne pointe pas vers Keycloak: ${keycloakUrl}`);

    // (C) suit les redirections jusqu'à la page de login (200 + formulaire)
    let html = null;
    for (let hop = 0; hop < 10 && keycloakUrl; hop++) {
        res = await get(keycloakUrl);
        if (res.status >= 300 && res.status < 400) {
            const next = new URL(res.headers.location, keycloakUrl);
            assert(next.host !== app.host, res.status,
                'Keycloak a redirigé vers /callback sans login (session SSO résiduelle ?)');
            keycloakUrl = next.href;
            continue;
        }
        assert(res.status === 200, res.status, `page de login Keycloak attendu 200, reçu ${res.status}`);
        html = res.data;
        break;
    }
    const formAction = extractLoginFormAction(html);
    assert(!!formAction, 'ERR', 'formulaire de login Keycloak introuvable (action manquante)');

    // (D) POST des identifiants → redirection vers /callback
    res = await client.post(formAction, new URLSearchParams({ username, password }), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    assert(res.status === 302, res.status,
        `POST credentials attendu 302→/callback, reçu ${res.status} (identifiants refusés ?)`);
    const callbackUrl = resolveUrl(formAction, res.headers.location);
    assert(new URL(callbackUrl).host === app.host, res.status,
        `Keycloak n'a pas redirigé vers l'app: ${callbackUrl}`);

    // (E) /callback côté app → échange du code, pose la session, 302 vers /
    res = await get(callbackUrl);
    assert(res.status === 302, res.status, `GET /callback attendu 302, reçu ${res.status}`);

    return { get };
}

/** Utilisateur AVEC le rôle dashboard-access → /dashboard 200 (+ rôle). */
async function sessionAllowSubtest() {
    const { get } = await loginViaBrowser(users.withAccess);
    const res = await get(`${app.url}/dashboard`);
    assert(res.status === 200, res.status, `GET /dashboard (authentifié) attendu 200, reçu ${res.status}`);
    assert((res.data?.user?.roles || []).includes('dashboard-access'), 'ERR',
        `rôle 'dashboard-access' absent du principal: ${JSON.stringify(res.data?.user?.roles)}`);
    return 'login form OK, /callback 302, /dashboard 200 + rôle dashboard-access';
}

/** Utilisateur authentifié SANS le rôle dashboard-access → /dashboard 403. */
async function sessionDenySubtest() {
    const { get } = await loginViaBrowser(users.withoutAccess);
    const res = await get(`${app.url}/dashboard`);
    assert(res.status === 403, res.status,
        `GET /dashboard (authentifié mais rôle insuffisant) attendu 403, reçu ${res.status}`);
    return 'login OK, rôle insuffisant → 403';
}

module.exports = { loginViaBrowser, sessionAllowSubtest, sessionDenySubtest };
