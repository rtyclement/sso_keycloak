require('dotenv').config({ path: ['.test.env'] });

const fastify = require('fastify')({ logger: false });
const kc      = require('./middleware/keycloak_fastify');

async function start() {
    // Route publique (déclarée AVANT protect → échappe à l'authentification)
    fastify.get('/health', async () => ({ status: 'ok' }));

    // /api/*  : mode bearer, rôle 'api-access'
    kc.protect(fastify, '/api/*', 'bearer', 'api-access');
    // tout le reste : mode session, rôle 'dashboard-access'
    kc.protect(fastify, null, 'session', 'dashboard-access');

    fastify.get('/api/info',  async (req) => ({ message: 'ok', user: req.principal }));
    fastify.get('/dashboard', async (req) => ({ user: req.principal }));
    fastify.get('/',          async (req) => ({ user: req.principal }));

    const port = Number(process.env.APP_PORT || 9090);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`[fastify] up on :${port}`);
}

start().catch((err) => { console.error('[fastify] start error:', err); process.exit(1); });
