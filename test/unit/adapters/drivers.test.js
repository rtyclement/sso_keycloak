const { test } = require('node:test');
const assert   = require('node:assert/strict');
const DRIVERS  = require('../../../src/adapters/Drivers');
const DriverContrat = require('../../../src/adapters/DriverContrat');

/** Objet sso minimal attendu par mountAuthRoutes. */
function buildFakeSso() {
    return {
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
}

/** App fake qui enregistre les routes GET/POST déclarées. */
function buildRouteRecorder(extra = {}) {
    const routes = [];
    const app = {
        get:  (path) => routes.push({ method: 'GET',  path }),
        post: (path) => routes.push({ method: 'POST', path }),
        ...extra,
    };
    return { app, routes };
}

// ---- Contrat -----------------------------------------------------------------

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

// ---- install ------------------------------------------------------------------

test('EXPRESS.install monte un middleware via app.use avec patterns', () => {
    const calls = [];
    const app   = { use: (...a) => calls.push(a) };

    DRIVERS.EXPRESS.install(app, [/^\/api$/], () => {});

    assert.equal(calls.length, 1);
    // c'est un wrapper middleware (function), pas handler directement
    assert.equal(typeof calls[0][0], 'function');
});

test('EXPRESS.install sans patterns monte le handler directement', () => {
    const calls   = [];
    const app     = { use: (...a) => calls.push(a) };
    const handler = () => {};

    DRIVERS.EXPRESS.install(app, null, handler);

    assert.equal(calls[0][0], handler);  // handler directement, pas de wrapper
});

test('EXPRESS.install filtre les routes', async () => {
    const calls = [];
    const app   = { use: (fn) => calls.push(fn) };
    const hits  = [];
    const handler = (req) => hits.push(req.originalUrl);

    DRIVERS.EXPRESS.install(app, [/^\/api$/], handler);

    const mw = calls[0];

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

    DRIVERS.FASTIFY.install(app, null, () => {});

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'onRequest');
});

test('FASTIFY.install filtre les routes si fourni', async () => {
    const hooks = [];
    const app   = { addHook: (name, fn) => hooks.push(fn) };
    const calls = [];
    const handler = async (req) => calls.push(req.url);

    DRIVERS.FASTIFY.install(app, [/^\/api$/], handler);

    const hook = hooks[0];

    await hook({ url: '/api' }, {});
    assert.equal(calls.length, 1);

    await hook({ url: '/autre' }, {});
    assert.equal(calls.length, 1);
});

// ---- mountAuthRoutes -------------------------------------------------------------

test('ExpressDriver.mountAuthRoutes enregistre /login, /callback et /backchannel-logout', () => {
    const { app, routes } = buildRouteRecorder({ use: () => {} });

    DRIVERS.EXPRESS.mountAuthRoutes(app, buildFakeSso());

    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/login'));
    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/callback'));
    assert.ok(routes.some(r => r.method === 'POST' && r.path === '/backchannel-logout'));
});

test('FastifyDriver.mountAuthRoutes enregistre /login, /callback et /backchannel-logout', () => {
    const { app, routes } = buildRouteRecorder({ addHook: () => {} });

    DRIVERS.FASTIFY.mountAuthRoutes(app, buildFakeSso());

    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/login'));
    assert.ok(routes.some(r => r.method === 'GET'  && r.path === '/callback'));
    assert.ok(routes.some(r => r.method === 'POST' && r.path === '/backchannel-logout'));
});

// ---- createStore -------------------------------------------------------------------

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

test('ExpressDriver.createStore — le reaper supprime les sessions expirées', (t, done) => {
    const store = DRIVERS.EXPRESS.createStore({ reapIntervalMs: 50 });  // intervalle court pour le test

    const expiredSession = {
        user:   'alice',
        cookie: { expires: new Date(Date.now() - 1000) },  // expirée il y a 1 seconde
    };

    store.set('sid-expired', expiredSession, () => {
        // attend que le reaper passe
        setTimeout(() => {
            store.get('sid-expired', (err, session) => {
                assert.equal(session, null);  // supprimée par le reaper
                done();
            });
        }, 150);  // attend 150ms > 50ms d'intervalle
    });
});

test('ExpressDriver.createStore — le reaper garde les sessions non expirées', (t, done) => {
    const store = DRIVERS.EXPRESS.createStore({ reapIntervalMs: 50 });

    const validSession = {
        user:   'bob',
        cookie: { expires: new Date(Date.now() + 60000) },  // expire dans 1 minute
    };

    store.set('sid-valid', validSession, () => {
        setTimeout(() => {
            store.get('sid-valid', (err, session) => {
                assert.ok(session !== null);  // toujours là
                done();
            });
        }, 150);
    });
});

test('FastifyDriver.createStore retourne un store avec get, set, destroy et reaper (même logique qu\'Express donc 1 seul test)', (t, done) => {
    const store = DRIVERS.FASTIFY.createStore({ reapIntervalMs: 50 });

    assert.equal(typeof store.get,     'function');
    assert.equal(typeof store.set,     'function');
    assert.equal(typeof store.destroy, 'function');

    const expiredSession = {
        cookie: { expires: new Date(Date.now() - 1000) },
    };

    store.set('sid-expired', expiredSession, () => {
        setTimeout(() => {
            store.get('sid-expired', (err, session) => {
                assert.equal(session, null);
                done();
            });
        }, 150);
    });
});

// ---- mountSession ---------------------------------------------------------------------

test('ExpressDriver.mountSession enregistre un middleware de session via app.use', () => {
    const middlewares = [];
    const app   = { use: (mw) => middlewares.push(mw) };
    const store = DRIVERS.EXPRESS.createStore();

    DRIVERS.EXPRESS.mountSession(app, { sessionSecret: 'secret', store });

    assert.equal(middlewares.length, 1);
    assert.equal(typeof middlewares[0], 'function');
});

test('mountSession avec allowHttp:true configure cookie.secure à false', () => {
    let capturedOptions = null;
    const app   = { use: () => {} };
    const store = DRIVERS.EXPRESS.createStore();
    const fakeSession = (opts) => { capturedOptions = opts; return () => {}; };

    DRIVERS.EXPRESS.mountSession(app, { sessionSecret: 's', store, allowHttp: true }, fakeSession);

    assert.equal(capturedOptions.cookie.secure, false);
});

test('mountSession avec allowHttp:false configure cookie.secure à true', () => {
    let capturedOptions = null;
    const app   = { use: () => {} };
    const store = DRIVERS.EXPRESS.createStore();
    const fakeSession = (opts) => { capturedOptions = opts; return () => {}; };

    DRIVERS.EXPRESS.mountSession(app, { sessionSecret: 's', store, allowHttp: false }, fakeSession);

    assert.equal(capturedOptions.cookie.secure, true);
});

test('FastifyDriver.mountSession enregistre cookie, session et formbody', async () => {
    const registered = [];
    const app   = { register: async (plugin, opts) => registered.push({ plugin, opts }) };
    const store = DRIVERS.FASTIFY.createStore();

    await DRIVERS.FASTIFY.mountSession(app, {
        sessionSecret: 'secret',
        store,
        allowHttp: true,
    });

    assert.equal(registered.length, 3);
});

test('FastifyDriver.mountSession avec allowHttp:true configure cookie.secure à false', async () => {
    let sessionOpts = null;
    const app = {
        register: async (plugin, opts) => {
            if (opts?.secret) sessionOpts = opts;  // c'est la config session
        },
    };
    const store = DRIVERS.FASTIFY.createStore();

    await DRIVERS.FASTIFY.mountSession(
        app,
        { sessionSecret: 'secret', store, allowHttp: true },
        { cookie: async () => {}, session: async () => {}, formbody: async () => {} },
    );

    assert.equal(sessionOpts.cookie.secure, false);
});
