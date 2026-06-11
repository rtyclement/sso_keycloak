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
const { compilePattern } = require('../src/Keycloak');
const { matchRule } = require('../src/Keycloak');
const { buildFakeClient } = require('./Helper.test');

test('Keycloak expose une méthode ready() qui retourne une Promise', () => {
    const kc = new Keycloak(DRIVERS.EXPRESS, {
        ...VALID_CONFIG,
        _client: buildFakeClient(),
    });
    assert.ok(kc.ready() instanceof Promise);
});

test('ready() se résout sans erreur avec un client valide', async () => {
    const kc = new Keycloak(DRIVERS.EXPRESS, {
        ...VALID_CONFIG,
        _client: buildFakeClient(),
    });
    await assert.doesNotReject(() => kc.ready());
});

test('protect appelle driver.install avec les patterns et un handler', () => {
    const installed = [];
    class TestDriver extends DriverContrat {
        getSession()   { return {}; }
        getHeaders()   { return {}; }
        getBody()      { return {}; }
        getUrl()       { return new URL('http://x/'); }
        getSessionId() { return 'id'; }
        setPrincipal() {}
        redirect()     {}
        deny()         {}
        ok()           {}
        wrap(l)        { return l; }
        install(app, patterns, handler) {
            installed.push({ app, patterns, handler });
        }
    }

    const kc  = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    const app = {};

    kc.protect(app, '/api', 'bearer');

    assert.equal(installed.length, 1);
    assert.equal(installed[0].app, app);
    assert.equal(installed[0].patterns.length, 1);
    assert.ok(installed[0].patterns[0] instanceof RegExp);
    assert.equal(typeof installed[0].handler, 'function');
});

test('le handler passe si aucune règle ne matche l\'URL', async () => {
    class TestDriver extends DriverContrat {
        getSession()   { return {}; }
        getHeaders()   { return {}; }
        getBody()      { return {}; }
        getUrl()       { return new URL('http://x/'); }
        getSessionId() { return 'id'; }
        setPrincipal() {}
        redirect()     {}
        deny()         {}
        ok()           {}
        wrap(l)        { return l; }
        install(app, patterns, handler) { app.handler = handler; }
    }

    const kc  = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    const app = {};

    kc.protect(app, '/api', 'bearer');

    const next = { called: false };
    await app.handler({ url: '/autre', headers: {} }, {}, () => { next.called = true; });

    assert.ok(next.called);
});

test('le handler marque _ssoHandled après avoir traité la requête', async () => {
    class TestDriver extends DriverContrat {
        getSession()   { return {}; }
        getHeaders()   { return {}; }
        getBody()      { return {}; }
        getUrl()       { return new URL('http://x/'); }
        getSessionId() { return 'id'; }
        setPrincipal() {}
        redirect()     {}
        deny()         {}
        ok()           {}
        wrap(l)        { return l; }
        install(app, patterns, handler) { app.handler = handler; }
    }

    const kc  = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    const app = {};

    kc.protect(app, '/api', 'bearer');

    const req = { url: '/api', headers: {} };
    await app.handler(req, {}, () => {});

    assert.ok(req._ssoHandled);
});

test('le handler skip si _ssoHandled est déjà true', async () => {
    let authCalls = 0;
    class TestDriver extends DriverContrat {
        getSession()   { return {}; }
        getHeaders()   { return {}; }
        getBody()      { return {}; }
        getUrl()       { return new URL('http://x/'); }
        getSessionId() { return 'id'; }
        setPrincipal() {}
        redirect()     {}
        deny()         {}
        ok()           {}
        wrap(l)        { return (...args) => { authCalls++; return l(...args); }; }
        install(app, patterns, handler) { app.handler = handler; }
    }

    const kc  = new Keycloak(new TestDriver(), { ...VALID_CONFIG, _client: buildFakeClient() });
    const app = {};

    kc.protect(app, '/api', 'bearer');

    const req = { url: '/api', headers: {}, _ssoHandled: true };
    await app.handler(req, {}, () => {});

    assert.equal(authCalls, 0);
});