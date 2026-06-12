const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Adapter  = require('../../src/adapters/Adapter');
const { makeFakeDriver } = require('../support/fakeDriver');
const { buildReq }       = require('../support/builders');

function buildAdapter(overrides) {
    const fake = makeFakeDriver(overrides);
    return { adapter: new Adapter(fake.driver), ...fake };
}

test('Adapter expose guard, loginRoute, callbackRoute et backchannelRoute', () => {
    const { adapter } = buildAdapter();

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

// ---- guard --------------------------------------------------------------

test('guard appelle continue et attache le principal sur allow', async () => {
    const { adapter, calls } = buildAdapter();
    const strategy = { authenticate: async () => ({ type: 'allow', principal: { id: 42 } }) };

    await adapter.guard(strategy)(buildReq(), {});

    assert.deepEqual(calls.principal, { id: 42 });
    assert.equal(calls.continued, true);
});

test('guard redirige sur redirect', async () => {
    const { adapter, calls } = buildAdapter();
    const strategy = { authenticate: async () => ({ type: 'redirect', url: '/login' }) };

    await adapter.guard(strategy)(buildReq(), {});

    assert.equal(calls.redirect, '/login');
    assert.equal(calls.continued, false);
});

test('guard appelle deny avec le bon status sur deny', async () => {
    const { adapter, calls } = buildAdapter();
    const strategy = { authenticate: async () => ({ type: 'deny', status: 403 }) };

    await adapter.guard(strategy)(buildReq(), {});

    assert.equal(calls.deny, 403);
});

// ---- loginRoute / callbackRoute -------------------------------------------

test('loginRoute redirige vers l\'url retournée par startLogin', async () => {
    const { adapter, calls } = buildAdapter();
    const strategy = { startLogin: async () => ({ type: 'redirect', url: 'https://kc.example.com/authorize' }) };

    await adapter.loginRoute(strategy)(buildReq(), {});

    assert.strictEqual(calls.redirect, 'https://kc.example.com/authorize');
});

test('callbackRoute redirige vers redirectTo après le callback', async () => {
    const { adapter, calls } = buildAdapter();
    const strategy    = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    const backchannel = { trackSession: () => {} };

    const req = buildReq({ session: { user: { sid: 'kc-sid' } } });
    await adapter.callbackRoute(strategy, backchannel)(req, {});

    assert.strictEqual(calls.redirect, '/');
});

test('callbackRoute appelle trackSession avec le sid et le sessionId', async () => {
    const { adapter } = buildAdapter();
    const strategy    = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    let capturedArgs  = null;
    const backchannel = { trackSession: (sid, sessionId) => { capturedArgs = { sid, sessionId }; } };

    const req = buildReq({
        session:   { user: { sid: 'kc-sid-abc' } },
        sessionId: 'express-sess-xyz',
    });
    await adapter.callbackRoute(strategy, backchannel)(req, {});

    assert.strictEqual(capturedArgs.sid,       'kc-sid-abc');
    assert.strictEqual(capturedArgs.sessionId, 'express-sess-xyz');
});

// ---- backchannelRoute -------------------------------------------------------

test('backchannelRoute répond 200 quand handle retourne 200', async () => {
    const { adapter, calls } = buildAdapter();
    const backchannel = { handle: async () => ({ status: 200 }) };

    await adapter.backchannelRoute(backchannel)(buildReq({ body: { logout_token: 'token' } }), {});

    assert.strictEqual(calls.status, 200);
});

test('backchannelRoute appelle deny quand handle retourne 400', async () => {
    const { adapter, calls } = buildAdapter();
    const backchannel = { handle: async () => ({ status: 400 }) };

    await adapter.backchannelRoute(backchannel)(buildReq(), {});

    assert.strictEqual(calls.status, 400);
});
