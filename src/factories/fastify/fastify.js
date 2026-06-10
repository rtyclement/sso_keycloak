const { createSso } = require('../core');
const Adapter       = require('../../adapters/Adapter');
const fp = require('fastify-plugin');

function required(value, name) {
    if (value === undefined || value === null)
        throw new Error(`[sso_keycloak/fastify] ${name} est obligatoire`);
    return value;
}

const PUBLIC_PATHS = new Set(['/login', '/callback', '/backchannel-logout']);

module.exports = function createFastifySso(deps = {}, config = {}) {
    required(deps.session,         'deps.session');    // @fastify/session
    required(deps.cookie,          'deps.cookie');     // @fastify/cookie
    required(deps.formbody,        'deps.formbody');   // @fastify/formbody
    required(config.sessionSecret, 'config.sessionSecret');
    required(config.issuerUrl,     'config.issuerUrl');
    required(config.clientId,      'config.clientId');
    required(config.clientSecret,  'config.clientSecret');
    required(config.requiredRole,  'config.requiredRole');

    return fp(async function ssoPlugin(fastify) {
        // Store partagé entre le plugin session ET le backchannel
        // Même rôle que new session.MemoryStore() dans express.js
        // → le user peut injecter le sien via config.sessionStore (ex: connect-redis)
        const store = config.sessionStore ?? (() => {
            const data = new Map();
            return {
                get:     (id, cb) => cb(null, data.get(id) ?? null),
                set:     (id, session, cb) => { data.set(id, session); cb(null); },
                destroy: (id, cb) => { data.delete(id); cb(null); },
            };
        })();

        await fastify.register(deps.cookie);
        await fastify.register(deps.session, {
            secret:            config.sessionSecret,
            saveUninitialized: false,
            store,                                   // ← même store pour session ET backchannel
            cookie:            { secure: false, httpOnly: true, sameSite: 'lax' },
        });
        await fastify.register(deps.formbody);

        const sso     = await createSso({ ...config, sessionStore: store });
        const adapter = new Adapter(Adapter.DRIVERS.FASTIFY);

        fastify.post('/backchannel-logout', adapter.backchannelRoute(sso.backchannel));
        fastify.get('/login',    adapter.loginRoute(sso.strategies.authorizationCode));
        fastify.get('/callback', adapter.callbackRoute(sso.strategies.authorizationCode, sso.backchannel));

        const guard = adapter.guard(sso.strategies.authorizationCode);
        fastify.addHook('onRequest', async (req, reply) => {
            if (PUBLIC_PATHS.has(req.url.split('?')[0])) return;
            await guard(req, reply);
        });
    });
};