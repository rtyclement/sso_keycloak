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