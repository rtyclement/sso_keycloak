const Adapter       = require('../../adapters/Adapter');
const { createSso } = require('../core');
const fp = require('fastify-plugin');

function required(value, name) {
    if (value === undefined || value === null)
        throw new Error(`[sso_keycloak/fastify-bearer] ${name} est obligatoire`);
    return value;
}

module.exports = function createFastifyBearerSso(deps = {}, config = {}) {
    required(config.issuerUrl,    'config.issuerUrl');
    required(config.clientId,     'config.clientId');
    required(config.clientSecret, 'config.clientSecret');
    required(config.requiredRole, 'config.requiredRole');

    // Préfixes publics configurables (ex: doc Swagger)
    const publicPrefixes = config.publicPrefixes ?? [];

    const adapter = new Adapter(Adapter.DRIVERS.FASTIFY);
    let guard     = null;

    const ready = createSso({ ...config, fetch: deps.fetch })
        .then(sso => { guard = adapter.guard(sso.strategies.introspection); })
        .catch(err => { console.error('[sso_keycloak/fastify-bearer] Init échouée :', err); process.exit(1); });

    return fp(async function fastifyBearerPlugin(fastify) {
        await ready;
        fastify.addHook('onRequest', async (req, reply) => {
            const path = req.url.split('?')[0];
            if (publicPrefixes.some(p => path.startsWith(p))) return;  // route publique
            await guard(req, reply);
        });
    });
};