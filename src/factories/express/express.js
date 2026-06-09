const { createSso } = require('../core');
const Adapter       = require('../../adapters/Adapter');

function required(value, name) {
    if (value === undefined || value === null) {
        throw new Error(`[sso_keycloak/express] ${name} est obligatoire`);
    }
    return value;
}

module.exports = function createExpressSso(deps = {}, config = {}) {
    const express = required(deps.express, 'deps.express');
    const session = required(deps.session, 'deps.session');
    required(config.sessionSecret, 'config.sessionSecret');

    const router = express.Router();
    const store  = config.sessionStore ?? new session.MemoryStore();
    const ready = createSso({ ...config, sessionStore: store }).then(sso => {
        console.log('[sso_keycloak] Discovery OK, routes câblées');
        const adapter = new Adapter(Adapter.DRIVERS.EXPRESS);

        router.use(session({
            secret:            config.sessionSecret,
            resave:            false,
            saveUninitialized: false,
            store,
        }));

        router.post('/backchannel-logout', express.urlencoded({ extended: false }),
        adapter.backchannelRoute(sso.backchannel));
        router.get('/login',    adapter.loginRoute(sso.strategies.authorizationCode));
        router.get('/callback', adapter.callbackRoute(sso.strategies.authorizationCode, sso.backchannel));
        router.use(adapter.guard(sso.strategies.authorizationCode));
    }).catch(err => {
        console.error('[sso_keycloak] Init échouée :', err);
        process.exit(1);
    });

    router.use((_req, _res, next) => ready.then(() => next()).catch(next));
    return router;
};