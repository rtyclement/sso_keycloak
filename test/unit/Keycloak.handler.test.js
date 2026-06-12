const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../../src/Keycloak');
const { makeFakeDriver }                          = require('./support/fakeDriver');
const { buildKeycloakConfig, buildStubFactories } = require('./support/builders');
const { buildReq }                                = require('./support/builders');

/**
 * Tests du handler installé par protect() : décisions, garde _ssoHandled,
 * vérification des rôles. Le driver et les stratégies sont entièrement
 * stubbés — seul le comportement du handler de Keycloak est sous test.
 */
function buildProtected({ config = {}, routes = '/api', mode = 'bearer', roles } = {}) {
    const fake = makeFakeDriver();
    const kc   = new Keycloak(fake.driver, buildKeycloakConfig(config));
    kc.protect({}, routes, mode, roles);
    return { kc, handler: fake.lastHandler(), ...fake };
}

test('le handler passe si aucune règle ne matche l\'URL', async () => {
    const { handler } = buildProtected();

    let nextCalled = false;
    await handler(buildReq({ url: '/autre' }), {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
});

test('le handler marque _ssoHandled après avoir traité la requête', async () => {
    const { handler } = buildProtected();

    const req = buildReq({ url: '/api' });
    await handler(req, {}, () => {});

    assert.ok(req._ssoHandled);
});

test('le handler skip si _ssoHandled est déjà true', async () => {
    let authenticateCalled = false;
    const { handler } = buildProtected({
        config: { _factories: buildStubFactories({ onAuthenticate: () => { authenticateCalled = true; } }) },
    });

    const req = buildReq({ url: '/api', _ssoHandled: true });
    let nextCalled = false;
    await handler(req, {}, () => { nextCalled = true; });

    assert.ok(nextCalled);              // next() appelé → pas bloqué
    assert.ok(req._ssoHandled);         // toujours true, pas réinitialisé
    assert.ok(!authenticateCalled);     // aucune stratégie sollicitée
});

test('le handler attend que la discovery soit prête', async () => {
    const { handler } = buildProtected();

    // si le handler plante car #ready pas attendu → le test échoue
    await assert.doesNotReject(() => handler(buildReq({ url: '/api' }), {}, () => {}));
});

test('le handler appelle strategy.authenticate pour le mode bearer', async () => {
    let authenticateCalled = false;
    const { handler } = buildProtected({
        config: { _factories: buildStubFactories({ onAuthenticate: () => { authenticateCalled = true; } }) },
    });

    await handler(buildReq({ url: '/api' }), {}, () => {});

    assert.ok(authenticateCalled);
});

// ---- Décisions ------------------------------------------------------------

test('décision allow → setPrincipal + next()', async () => {
    const { handler, calls } = buildProtected({
        config: { _factories: buildStubFactories({ decision: { type: 'allow', principal: { id: 99 } } }) },
    });

    let nextCalled = false;
    await handler(buildReq({ url: '/api' }), {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
    assert.deepEqual(calls.principal, { id: 99 });
});

test('décision deny → driver.deny avec le bon status', async () => {
    const { handler, calls } = buildProtected({
        config: { _factories: buildStubFactories({ decision: { type: 'deny', status: 403 } }) },
    });

    await handler(buildReq({ url: '/api' }), {}, () => {});

    assert.equal(calls.deny, 403);
});

test('décision redirect → driver.redirect avec la bonne url', async () => {
    const { handler, calls } = buildProtected({
        mode:   'session',
        config: { _factories: buildStubFactories({ decision: { type: 'redirect', url: '/login' } }) },
    });

    await handler(buildReq({ url: '/api' }), {}, () => {});

    assert.equal(calls.redirect, '/login');
});

// ---- Rôles ------------------------------------------------------------------

test('le handler retourne 403 si le principal n\'a pas le rôle requis', async () => {
    const { handler, calls } = buildProtected({
        roles:  ['admin'],  // exige 'admin'
        config: { _factories: buildStubFactories({ decision: { type: 'allow', principal: { roles: ['reader'] } } }) },
    });

    await handler(buildReq({ url: '/api' }), {}, () => {});

    assert.equal(calls.deny, 403);
});

test('le handler laisse passer si le principal a le rôle requis', async () => {
    const { handler } = buildProtected({
        roles:  ['admin'],
        config: { _factories: buildStubFactories({ decision: { type: 'allow', principal: { roles: ['admin'] } } }) },
    });

    let nextCalled = false;
    await handler(buildReq({ url: '/api' }), {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
});

test('le handler laisse passer si aucun rôle n\'est requis', async () => {
    const { handler } = buildProtected({
        config: { _factories: buildStubFactories({ decision: { type: 'allow', principal: { roles: [] } } }) },
    });

    let nextCalled = false;
    await handler(buildReq({ url: '/api' }), {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
});
