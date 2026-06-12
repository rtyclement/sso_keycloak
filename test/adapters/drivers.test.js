const { test } = require('node:test');
const assert   = require('node:assert/strict');
const DRIVERS  = require('../../src/adapters/Drivers');
const DriverContrat   = require('../../src/adapters/DriverContrat');

test('EXPRESS et FASTIFY sont des instances de DriverContrat', () => {
    assert.ok(DRIVERS.EXPRESS instanceof DriverContrat);
    assert.ok(DRIVERS.FASTIFY instanceof DriverContrat);
});

test('EXPRESS implémente tout le contrat sans throw', () => {
    const d = DRIVERS.EXPRESS;
    assert.doesNotThrow(() => d.getSession({ session: {} }));
    assert.doesNotThrow(() => d.wrap(() => {}));
    assert.equal(typeof d.install, 'function');
});

test('FASTIFY implémente tout le contrat sans throw', () => {
    const d = DRIVERS.FASTIFY;
    assert.doesNotThrow(() => d.getSession({ session: {} }));
    assert.doesNotThrow(() => d.wrap(() => {}));
    assert.equal(typeof d.install, 'function');
});

test('EXPRESS.install monte un middleware via app.use avec patterns', () => {
    const calls = [];
    const app   = { use: (...a) => calls.push(a) };
    const handler = () => {};

    DRIVERS.EXPRESS.install(app, [/^\/api$/], handler);

    assert.equal(calls.length, 1);
    // c'est un wrapper middleware (function), pas handler directement
    assert.equal(typeof calls[0][0], 'function');
});

test('EXPRESS.install sans patterns monte le handler directement', () => {
    const calls = [];
    const app   = { use: (...a) => calls.push(a) };
    const handler = () => {};

    DRIVERS.EXPRESS.install(app, null, handler);

    assert.equal(calls[0][0], handler);  // handler directement, pas de wrapper
});

test('EXPRESS.install filtre les routes', async () => {
    const calls = [];
    const app   = { use: (fn) => calls.push(fn) };
    const hits  = [];
    const handler = (req, res, next) => hits.push(req.originalUrl);

    DRIVERS.EXPRESS.install(app, [/^\/api$/], handler);

    const mw   = calls[0];
    const next = { called: false };

    // matche
    await mw({ originalUrl: '/api' }, {}, () => {});
    assert.equal(hits.length, 1);

    // ne matche pas
    await mw({ originalUrl: '/autre' }, {}, () => {});
    assert.equal(hits.length, 1);
});

test('FASTIFY.install ajoute un hook onRequest', () => {
    const calls = [];
    const app   = { addHook: (name, fn) => calls.push({ name, fn }) };
    const handler = () => {};

    DRIVERS.FASTIFY.install(app, null, handler);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'onRequest');
});

test('FASTIFY.install filtre les routes si fourni', async () => {
    const hooks = [];
    const app   = { addHook: (name, fn) => hooks.push(fn) };
    const calls = [];
    const handler = async (req, reply) => calls.push(req.url);

    DRIVERS.FASTIFY.install(app, [/^\/api$/], handler);

    const hook = hooks[0];

    await hook({ url: '/api' }, {});
    assert.equal(calls.length, 1);

    await hook({ url: '/autre' }, {});
    assert.equal(calls.length, 1);
});

test('ExpressDriver.mountAuthRoutes enregistre /login, /callback et /backchannel-logout', async () => {
    const routes = [];
    const app    = {
        get:  (path, handler) => routes.push({ method: 'GET',  path }),
        post: (path, handler) => routes.push({ method: 'POST', path }),
        use:  () => {},
    };

    const sso = {
        strategies: {
            authorizationCode: {
                startLogin:     async () => ({ type: 'redirect', url: '/kc' }),
                handleCallback: async () => ({ type: 'session',  redirectTo: '/' }),
            },
        },
        backchannel: {
            handle:       async () => ({ status: 200 }),
            trackSession: () => {},
        },
    };

    DRIVERS.EXPRESS.mountAuthRoutes(app, sso);

    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/login'));
    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/callback'));
    assert.ok(routes.some(r => r.method === 'POST' && r.path === '/backchannel-logout'));
});

test('FastifyDriver.mountAuthRoutes enregistre /login, /callback et /backchannel-logout', async () => {
    const routes = [];
    const app    = {
        get:  (path, handler) => routes.push({ method: 'GET',  path }),
        post: (path, handler) => routes.push({ method: 'POST', path }),
        addHook: () => {},
    };

    const sso = {
        strategies: {
            authorizationCode: {
                startLogin:     async () => ({ type: 'redirect', url: '/kc' }),
                handleCallback: async () => ({ type: 'session',  redirectTo: '/' }),
            },
        },
        backchannel: {
            handle:       async () => ({ status: 200 }),
            trackSession: () => {},
        },
    };

    DRIVERS.FASTIFY.mountAuthRoutes(app, sso);

    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/login'));
    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/callback'));
    assert.ok(routes.some(r => r.method === 'POST' && r.path === '/backchannel-logout'));
});

test('ExpressDriver.createStore retourne un store avec get, set, destroy', () => {
    const store = DRIVERS.EXPRESS.createStore();

    assert.equal(typeof store.get,     'function');
    assert.equal(typeof store.set,     'function');
    assert.equal(typeof store.destroy, 'function');
});

test('ExpressDriver.createStore — set puis get retourne la session', (t, done) => {
    const store = DRIVERS.EXPRESS.createStore();

    store.set('sid1', { user: 'alice' }, () => {
        store.get('sid1', (err, session) => {
            assert.equal(err, null);
            assert.deepEqual(session, { user: 'alice' });
            done();
        });
    });
});

test('ExpressDriver.createStore — destroy supprime la session', (t, done) => {
    const store = DRIVERS.EXPRESS.createStore();

    store.set('sid2', { user: 'bob' }, () => {
        store.destroy('sid2', () => {
            store.get('sid2', (err, session) => {
                assert.equal(session, null);
                done();
            });
        });
    });
});