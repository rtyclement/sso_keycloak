const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Adapter  = require('../../src/adapters/Adapter');
const {buildFakeDriver, buildReq} = require('../Helper.test');


test('Adapter expose guard, loginRoute, callbackRoute et backchannelRoute', () => {
    const { driver } = buildFakeDriver();
    const adapter    = new Adapter(driver);

    assert.strictEqual(typeof adapter.guard,            'function');
    assert.strictEqual(typeof adapter.loginRoute,       'function');
    assert.strictEqual(typeof adapter.callbackRoute,    'function');
    assert.strictEqual(typeof adapter.backchannelRoute, 'function');
});

test('Adapter.DRIVERS expose EXPRESS et FASTIFY avec les bonnes clés', () => {
    const keys = ['getSession', 'getHeaders', 'getBody', 'getUrl',
                  'getSessionId', 'setPrincipal', 'redirect', 'deny', 'ok', 'continue'];

    for (const key of keys) {
        assert.strictEqual(typeof Adapter.DRIVERS.EXPRESS[key], 'function', `EXPRESS manque : ${key}`);
        assert.strictEqual(typeof Adapter.DRIVERS.FASTIFY[key], 'function', `FASTIFY manque : ${key}`);
    }
});

test('guard appelle continue et attache le principal sur allow', async () => {
    const principal    = { sub: 'user-123', roles: ['admin'] };
    const fakeStrategy = { authenticate: async () => ({ type: 'allow', principal }) };
    const { driver, log } = buildFakeDriver();
    const adapter      = new Adapter(driver);

    const req  = buildReq();
    let nextCalled = false;

    await adapter.guard(fakeStrategy)(req, {}, () => { nextCalled = true; });

    assert.ok(nextCalled);
    assert.strictEqual(log.principal, principal);
});

test('guard redirige sur redirect', async () => {
    const fakeStrategy    = { authenticate: async () => ({ type: 'redirect', url: '/login' }) };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.guard(fakeStrategy)(buildReq(), {}, () => {});

    assert.strictEqual(log.redirect, '/login');
});

test('guard appelle deny avec le bon status sur deny', async () => {
    const fakeStrategy    = { authenticate: async () => ({ type: 'deny', status: 403 }) };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.guard(fakeStrategy)(buildReq(), {}, () => {});

    assert.strictEqual(log.status, 403);
});

test('loginRoute redirige vers l\'url retournée par startLogin', async () => {
    const fakeStrategy    = { startLogin: async () => ({ type: 'redirect', url: 'https://kc.example.com/authorize' }) };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.loginRoute(fakeStrategy)(buildReq(), {});

    assert.strictEqual(log.redirect, 'https://kc.example.com/authorize');
});

test('callbackRoute redirige vers redirectTo après le callback', async () => {
    const fakeStrategy    = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    const fakeBackchannel = { trackSession: () => {} };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    const req = buildReq({ session: { user: { sid: 'kc-sid' } } });
    await adapter.callbackRoute(fakeStrategy, fakeBackchannel)(req, {});

    assert.strictEqual(log.redirect, '/');
});

test('callbackRoute appelle trackSession avec le sid et le sessionId', async () => {
    const fakeStrategy = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    let capturedArgs   = null;
    const fakeBackchannel = { trackSession: (sid, sessionId) => { capturedArgs = { sid, sessionId }; } };
    const { driver }   = buildFakeDriver();
    const adapter      = new Adapter(driver);

    const req = buildReq({
        session:   { user: { sid: 'kc-sid-abc' } },
        sessionId: 'express-sess-xyz',
    });
    await adapter.callbackRoute(fakeStrategy, fakeBackchannel)(req, {});

    assert.strictEqual(capturedArgs.sid,       'kc-sid-abc');
    assert.strictEqual(capturedArgs.sessionId, 'express-sess-xyz');
});

test('backchannelRoute répond avec le status retourné par handle', async () => {
    const fakeBackchannel = { handle: async () => ({ status: 200 }) };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    const req = buildReq({ body: { logout_token: 'token' } });
    await adapter.backchannelRoute(fakeBackchannel)(req, {});

    assert.strictEqual(log.status, 200);
});

test('backchannelRoute appelle deny quand handle retourne 400', async () => {
    const fakeBackchannel = { handle: async () => ({ status: 400 }) };
    const { driver, log } = buildFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.backchannelRoute(fakeBackchannel)(buildReq(), {});

    assert.strictEqual(log.status, 400);
});