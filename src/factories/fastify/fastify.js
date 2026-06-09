const { createSso } = require('../core');
const Adapter       = require('../../adapters/Adapter');

function required(value, name) {
    if (value === undefined || value === null)
        throw new Error(`[sso_keycloak/fastify] ${name} est obligatoire`);
    return value;
}

// Store en mémoire compatible @fastify/session ET backchannel (get/set/destroy)
// Même interface qu'express-session — pas de dépendance externe
function createMemoryStore() {
    const data = new Map();
    return {
        get:     (id, cb) => cb(null, data.get(id) ?? null),
        set:     (id, session, cb) => { data.set(id, session); cb(null); },
        destroy: (id, cb) => { data.delete(id); cb(null); },
    };
}

const PUBLIC_PATHS = new Set(['/login', '/callback', '/backchannel-logout']);

module.exports = function createFastifySso(deps = {}, config = {}) {
    required(deps.session,         'deps.session');        // @fastify/session
    required(config.sessionSecret, 'config.sessionSecret');
    required(config.issuerUrl,     'config.issuerUrl');
    required(config.clientId,      'config.clientId');
    required(config.clientSecret,  'config.clientSecret');
    required(config.requiredRole,  'config.requiredRole');

    return async function ssoPlugin(fastify) {
        const store = config.sessionStore ?? createMemoryStore();

        // @fastify/cookie : requis par @fastify/session
        // injectable via deps.cookie, sinon résolu depuis le projet consommateur
        await fastify.register(deps.cookie ?? require('@fastify/cookie'));

        // Session
        await fastify.register(deps.session, {
            secret:            config.sessionSecret,
            saveUninitialized: false,
            store,
            cookie: { secure: false, httpOnly: true, sameSite: 'lax' },
        });

        // Body urlencoded — nécessaire pour le backchannel logout (Keycloak POST)
        await fastify.register(deps.formbody ?? require('@fastify/formbody'));

        // Discovery + stratégies — même appel que express.js, aucune duplication
        const sso     = await createSso({ ...config, sessionStore: store });
        const adapter = new Adapter(Adapter.DRIVERS.FASTIFY);

        // Routes publiques — enregistrées AVANT la garde
        fastify.post('/backchannel-logout', adapter.backchannelRoute(sso.backchannel));
        fastify.get('/login',    adapter.loginRoute(sso.strategies.authorizationCode));
        fastify.get('/callback', adapter.callbackRoute(sso.strategies.authorizationCode, sso.backchannel));

        // Garde globale — créée une seule fois, pas à chaque requête
        const guard = adapter.guard(sso.strategies.authorizationCode);

        fastify.addHook('onRequest', async (req, reply) => {
            if (PUBLIC_PATHS.has(req.url.split('?')[0])) return; // routes publiques libres
            await guard(req, reply);
        });
    };
};