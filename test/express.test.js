const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { guard, loginRoute, callbackRoute, backchannelRoute } = require('../adapters/express');

test('express adapter exporte guard, loginRoute, callbackRoute, backchannelRoute', () => {
    assert.strictEqual(typeof guard,            'function');
    assert.strictEqual(typeof loginRoute,       'function');
    assert.strictEqual(typeof callbackRoute,    'function');
    assert.strictEqual(typeof backchannelRoute, 'function');
});

function buildReq(overrides = {}) {
    return { headers: {}, session: {}, sessionID: 'sess-123', originalUrl: '/callback', protocol: 'https', ...overrides };
}

function buildRes() {
    return {
        _status: null, _redirectUrl: null, _ended: false,
        status(code) { this._status = code; return this; },
        redirect(url) { this._redirectUrl = url; },
        end()        { this._ended = true; return this; },
    };
}

test('guard appelle next() et attache le principal quand la décision est allow', async () => {
    const principal    = { sub: 'user-123', roles: ['admin'] };
    const fakeStrategy = { authenticate: async () => ({ type: 'allow', principal }) };

    const req        = buildReq();
    const res        = buildRes();
    let nextCalled   = false;
    const next       = () => { nextCalled = true; };

    await guard(fakeStrategy)(req, res, next);

    assert.ok(nextCalled);
    assert.strictEqual(req.principal, principal);
});

test('guard redirige quand la décision est redirect', async () => {
    const fakeStrategy = { authenticate: async () => ({ type: 'redirect', url: '/login' }) };

    const req  = buildReq();
    const res  = buildRes();

    await guard(fakeStrategy)(req, res, () => {});

    assert.strictEqual(res._redirectUrl, '/login');
});

test('guard retourne le status HTTP quand la décision est deny', async () => {
    const fakeStrategy = { authenticate: async () => ({ type: 'deny', status: 403 }) };

    const req  = buildReq();
    const res  = buildRes();

    await guard(fakeStrategy)(req, res, () => {});

    assert.strictEqual(res._status, 403);
    assert.ok(res._ended);
});

test('loginRoute redirige vers l\'url retournée par startLogin', async () => {
    const fakeStrategy = { startLogin: async () => ({ type: 'redirect', url: 'https://kc.example.com/authorize' }) };

    const req = buildReq();
    const res = buildRes();

    await loginRoute(fakeStrategy)(req, res);

    assert.strictEqual(res._redirectUrl, 'https://kc.example.com/authorize');
});

test('callbackRoute redirige vers redirectTo après le callback', async () => {
    const fakeStrategy    = { handleCallback: async () => ({ type: 'session', redirectTo: '/' }) };
    const fakeBackchannel = { trackSession: () => {} };

    const req = buildReq({
        session:    { user: { sid: 'kc-sid' } },
        headers:    { host: 'app.example.com' },
    });
    const res = buildRes();

    await callbackRoute(fakeStrategy, fakeBackchannel)(req, res);

    assert.strictEqual(res._redirectUrl, '/');
});