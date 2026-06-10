const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Adapter  = require('../../src/adapters/Adapter');
const {makeFakeDriver, buildReq} = require('../Helper.test');


test('Adapter expose guard, loginRoute, callbackRoute et backchannelRoute', () => {
    const { driver } = makeFakeDriver();
    const adapter    = new Adapter(driver);

    assert.strictEqual(typeof adapter.guard,            'function');
    assert.strictEqual(typeof adapter.loginRoute,       'function');
    assert.strictEqual(typeof adapter.callbackRoute,    'function');
    assert.strictEqual(typeof adapter.backchannelRoute, 'function');
});

test('Adapter.DRIVERS expose EXPRESS et FASTIFY avec les bonnes clés', () => {
    const EXPECTED = [
        'getSession', 'getHeaders', 'getBody', 'getUrl', 'getSessionId',
        'setPrincipal', 'redirect', 'deny', 'ok', 'wrap',
    ];
    for (const driver of ['EXPRESS', 'FASTIFY']) {
        for (const key of EXPECTED) {
            assert.equal(typeof Adapter.DRIVERS[driver][key], 'function', `${driver} manque : ${key}`);
        }
    }
});

test('guard appelle continue et attache le principal sur allow', async () => {
    const { driver, calls } = makeFakeDriver();
    const adapter = new Adapter(driver);

    const strategy = { authenticate: async () => ({ type: 'allow', principal: { id: 42 } }) };
    const handler  = adapter.guard(strategy);

    await handler({ session: {}, headers: {} }, {});

    assert.deepEqual(calls.principal, { id: 42 });
    assert.equal(calls.continued, true);
});

test('guard redirige sur redirect', async () => {
    const { driver, calls } = makeFakeDriver();
    const adapter  = new Adapter(driver);
    const strategy = { authenticate: async () => ({ type: 'redirect', url: '/login' }) };

    await adapter.guard(strategy)({ session: {}, headers: {} }, {});

    assert.equal(calls.redirect, '/login');
    assert.equal(calls.continued, false);
});

test('guard appelle deny avec le bon status sur deny', async () => {
    const { driver, calls } = makeFakeDriver();
    const adapter  = new Adapter(driver);
    const strategy = { authenticate: async () => ({ type: 'deny', status: 403 }) };

    await adapter.guard(strategy)({ session: {}, headers: {} }, {});

    assert.equal(calls.deny, 403);
});

test('loginRoute redirige vers l\'url retournée par startLogin', async () => {
    const fakeStrategy    = { startLogin: async () => ({ type: 'redirect', url: 'https://kc.example.com/authorize' }) };
    const { driver, log } = makeFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.loginRoute(fakeStrategy)(buildReq(), {});

    assert.strictEqual(log.redirect, 'https://kc.example.com/authorize');
});

test('callbackRoute redirige vers redirectTo après le callback', async () => {
    const fakeStrategy    = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    const fakeBackchannel = { trackSession: () => {} };
    const { driver, log } = makeFakeDriver();
    const adapter         = new Adapter(driver);

    const req = buildReq({ session: { user: { sid: 'kc-sid' } } });
    await adapter.callbackRoute(fakeStrategy, fakeBackchannel)(req, {});

    assert.strictEqual(log.redirect, '/');
});

test('callbackRoute appelle trackSession avec le sid et le sessionId', async () => {
    const fakeStrategy = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    let capturedArgs   = null;
    const fakeBackchannel = { trackSession: (sid, sessionId) => { capturedArgs = { sid, sessionId }; } };
    const { driver }   = makeFakeDriver();
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
    const { driver, log } = makeFakeDriver();
    const adapter         = new Adapter(driver);

    const req = buildReq({ body: { logout_token: 'token' } });
    await adapter.backchannelRoute(fakeBackchannel)(req, {});

    assert.strictEqual(log.status, 200);
});

test('backchannelRoute appelle deny quand handle retourne 400', async () => {
    const fakeBackchannel = { handle: async () => ({ status: 400 }) };
    const { driver, log } = makeFakeDriver();
    const adapter         = new Adapter(driver);

    await adapter.backchannelRoute(fakeBackchannel)(buildReq(), {});

    assert.strictEqual(log.status, 400);
});