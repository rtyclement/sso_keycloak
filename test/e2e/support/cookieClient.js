/**
 * Client HTTP « façon navigateur » pour les flux de login Keycloak.
 */
const axios = require('axios');

/**
 * Crée un client axios qui mémorise et renvoie les cookies, MAIS ignore
 * volontairement le flag `Secure`.
 *
 * Pourquoi ignorer `Secure` : Keycloak pose ses cookies de session en
 * `SameSite=None` (donc `Secure`), qu'une vraie jarre (tough-cookie) refuserait
 * d'émettre sur `http://`. En local/HTTP c'est légitime de les conserver.
 *
 * `maxRedirects: 0` : on ne suit pas les redirections automatiquement, pour que
 * chaque 30x du flux OAuth reste observable et vérifiable par le sous-test.
 */
function createBrowserClient() {
    const cookies = new Map();   // nom -> valeur
    const client  = axios.create({ maxRedirects: 0, validateStatus: () => true });

    client.interceptors.request.use((cfg) => {
        if (cookies.size) {
            cfg.headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        }
        return cfg;
    });

    client.interceptors.response.use((res) => {
        for (const setCookie of res.headers['set-cookie'] || []) {
            const pair = setCookie.split(';')[0];
            const eq   = pair.indexOf('=');
            if (eq === -1) continue;
            const name  = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (!value || value === 'deleted') cookies.delete(name);
            else cookies.set(name, value);
        }
        return res;
    });

    return client;
}

module.exports = { createBrowserClient };
