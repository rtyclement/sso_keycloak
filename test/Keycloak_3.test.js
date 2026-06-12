const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');
const DRIVERS  = require('../src/adapters/Drivers');
const DriverContrat = require('../src/adapters/DriverContrat');
const VALID_CONFIG = {
    issuerUrl:     'http://kc/realms/r',
    clientId:      'c',
    clientSecret:  's',
    requiredRole:  'role',
    sessionSecret: 'secret',
};
const { buildFakeClient, buildFakeClient2 } = require('./Helper.test');

test('protect en mode session monte les routes d\'auth au premier appel', async () => {
    const routesInstalled = [];
    class TestDriver extends DriverContrat {
        getSession()               { return {}; }
        getHeaders()               { return {}; }
        getBody()                  { return {}; }
        getUrl()                   { return new URL('http://x/'); }
        getSessionId()             { return 'id'; }
        setPrincipal()             {}
        redirect()                 {}
        deny()                     {}
        ok()                       {}
        wrap(l)                    { return l; }
        install(app, p, h)         { routesInstalled.push({ p, h }); }
        mountAuthRoutes(app, sso)  { app.mounted = sso; }
        createStore(){}
        mountSession(){}
    }

    const kc  = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    const app = { mounted: null };

    kc.protect(app, '/dashboard', 'session');

    await kc.ready();  // laisse le .then() de mountAuthRoutes s'exécuter

    assert.ok(app.mounted !== null);
});

test('mountAuthRoutes n\'est appelé qu\'une seule fois même avec plusieurs protect session', async () => {
    let mountCount = 0;
    class TestDriver extends DriverContrat {
        getSession()              { return {}; }
        getHeaders()              { return {}; }
        getBody()                 { return {}; }
        getUrl()                  { return new URL('http://x/'); }
        getSessionId()            { return 'id'; }
        setPrincipal()            {}
        redirect()                {}
        deny()                    {}
        ok()                      {}
        wrap(l)                   { return l; }
        install(app, p, h)        {}
        mountAuthRoutes(app, sso) { mountCount++; }
        createStore(){}
        mountSession(){}
    }

    const kc = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });

    kc.protect({}, '/dashboard', 'session');
    kc.protect({}, '/admin',     'session');
    kc.protect({}, '/profile',   'session');

    await kc.ready();

    assert.equal(mountCount, 1);
});

test('Keycloak appelle driver.createStore au constructeur', () => {
    let createStoreCalled = false;
    class TestDriver extends DriverContrat {
        getSession()              { return {}; }
        getHeaders()              { return {}; }
        getBody()                 { return {}; }
        getUrl()                  { return new URL('http://x/'); }
        getSessionId()            { return 'id'; }
        setPrincipal()            {}
        redirect()                {}
        deny()                    {}
        ok()                      {}
        wrap(l)                   { return l; }
        install()                 {}
        mountAuthRoutes()         {}
        mountSession()            {}
        createStore()             { createStoreCalled = true; return {}; }
    }

    new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });

    assert.ok(createStoreCalled);
});

test('Keycloak appelle driver.mountSession au premier protect session', async () => {
    let mountSessionCalled = false;
    class TestDriver extends DriverContrat {
        getSession()              { return {}; }
        getHeaders()              { return {}; }
        getBody()                 { return {}; }
        getUrl()                  { return new URL('http://x/'); }
        getSessionId()            { return 'id'; }
        setPrincipal()            {}
        redirect()                {}
        deny()                    {}
        ok()                      {}
        wrap(l)                   { return l; }
        install()                 {}
        mountAuthRoutes()         {}
        createStore()             { return {}; }
        mountSession()            { mountSessionCalled = true; }
    }

    const kc = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    kc.protect({}, '/dashboard', 'session');

    await kc.ready();

    assert.ok(mountSessionCalled);
});

test('mountSession n\'est appelé qu\'une seule fois', async () => {
    let mountSessionCount = 0;
    class TestDriver extends DriverContrat {
        getSession()              { return {}; }
        getHeaders()              { return {}; }
        getBody()                 { return {}; }
        getUrl()                  { return new URL('http://x/'); }
        getSessionId()            { return 'id'; }
        setPrincipal()            {}
        redirect()                {}
        deny()                    {}
        ok()                      {}
        wrap(l)                   { return l; }
        install()                 {}
        mountAuthRoutes()         {}
        createStore()             { return {}; }
        mountSession()            { mountSessionCount++; }
    }

    const kc = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    kc.protect({}, '/dashboard', 'session');
    kc.protect({}, '/admin',     'session');

    await kc.ready();

    assert.equal(mountSessionCount, 1);
});

test('mountSession n\'est pas appelé en mode bearer', async () => {
    let mountSessionCalled = false;
    class TestDriver extends DriverContrat {
        getSession()              { return {}; }
        getHeaders()              { return {}; }
        getBody()                 { return {}; }
        getUrl()                  { return new URL('http://x/'); }
        getSessionId()            { return 'id'; }
        setPrincipal()            {}
        redirect()                {}
        deny()                    {}
        ok()                      {}
        wrap(l)                   { return l; }
        install()                 {}
        mountAuthRoutes()         {}
        createStore()             { return {}; }
        mountSession()            { mountSessionCalled = true; }
    }

    const kc = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    kc.protect({}, '/api', 'bearer');

    await kc.ready();

    assert.ok(!mountSessionCalled);
});