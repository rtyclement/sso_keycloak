const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');
const { makeFakeDriver }      = require('./support/fakeDriver');
const { buildKeycloakConfig } = require('./support/builders');

/**
 * Cycle de vie du mode session : montage des routes d'auth et du middleware
 * de session (une seule fois, uniquement en mode session).
 */
function buildKc() {
    const fake = makeFakeDriver();
    const kc   = new Keycloak(fake.driver, buildKeycloakConfig());
    return { kc, ...fake };
}

test('protect en mode session monte les routes d\'auth au premier appel', async () => {
    const { kc, calls } = buildKc();
    const app = {};

    kc.protect(app, '/dashboard', 'session');

    await kc.ready();  // laisse le .then() de mountAuthRoutes s'exécuter

    assert.equal(calls.mountAuthRoutes.length, 1);
    assert.equal(calls.mountAuthRoutes[0].app, app);
});

test('mountAuthRoutes n\'est appelé qu\'une seule fois même avec plusieurs protect session', async () => {
    const { kc, calls } = buildKc();

    kc.protect({}, '/dashboard', 'session');
    kc.protect({}, '/admin',     'session');
    kc.protect({}, '/profile',   'session');

    await kc.ready();

    assert.equal(calls.mountAuthRoutes.length, 1);
});

test('Keycloak appelle driver.mountSession au premier protect session', async () => {
    const { kc, calls } = buildKc();

    kc.protect({}, '/dashboard', 'session');

    await kc.ready();

    assert.equal(calls.mountSession.length, 1);
});

test('mountSession n\'est appelé qu\'une seule fois', async () => {
    const { kc, calls } = buildKc();

    kc.protect({}, '/dashboard', 'session');
    kc.protect({}, '/admin',     'session');

    await kc.ready();

    assert.equal(calls.mountSession.length, 1);
});

test('mountSession n\'est pas appelé en mode bearer', async () => {
    const { kc, calls } = buildKc();

    kc.protect({}, '/api', 'bearer');

    await kc.ready();

    assert.equal(calls.mountSession.length, 0);
});
