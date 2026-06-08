const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createBackchannel = require('../backchannel');

// Fake verify : simule un token valide avec le payload fourni
function buildFakeVerify(decoded) {
    return (_token, _getKey, _opts, callback) => callback(null, decoded);
}

// Fake verify : simule un token invalide
function buildFailingVerify() {
    return (_token, _getKey, _opts, callback) => callback(new Error('invalid signature'));
}

// Fake sessionStore
function buildFakeStore() {
    const destroyed = [];
    return {
        store:     { destroy: (id, cb) => { destroyed.push(id); cb(); } },
        destroyed,
    };
}

const VALID_DECODED = {
    sid:    'kc-session-abc',
    events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
};

test('createBackchannel retourne un objet avec handle et trackSession', () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
    });

    assert.strictEqual(typeof bc.handle,       'function');
    assert.strictEqual(typeof bc.trackSession, 'function');
});

test('handle retourne 400 quand logout_token est absent', async () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
    });

    const decision = await bc.handle({ body: {} });

    assert.strictEqual(decision.status, 400);
    assert.strictEqual(decision.reason, 'no_logout_token');
});

test('handle retourne 400 quand le token est invalide', async () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
        _verify:      buildFailingVerify(),
    });

    const decision = await bc.handle({ body: { logout_token: 'mauvais-token' } });

    assert.strictEqual(decision.status, 400);
    assert.strictEqual(decision.reason, 'invalid_token');
});

test('handle retourne 400 quand l\'event backchannel-logout est manquant', async () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
        _verify:      buildFakeVerify({ sid: 'kc-session-abc', events: {} }),
    });

    const decision = await bc.handle({ body: { logout_token: 'token' } });

    assert.strictEqual(decision.status, 400);
    assert.strictEqual(decision.reason, 'missing_event');
});

test('handle retourne 400 quand sid est manquant', async () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
        _verify:      buildFakeVerify({
            events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
        }),
    });

    const decision = await bc.handle({ body: { logout_token: 'token' } });

    assert.strictEqual(decision.status, 400);
    assert.strictEqual(decision.reason, 'missing_sid');
});

test('handle retourne 200 et détruit la session correspondante', async () => {
    const { store, destroyed } = buildFakeStore();
    const bc = createBackchannel({
        sessionStore: store,
        jwksUri:      'https://kc.example.com/certs',
        _verify:      buildFakeVerify(VALID_DECODED),
    });

    bc.trackSession('kc-session-abc', 'express-session-xyz');
    const decision = await bc.handle({ body: { logout_token: 'token' } });

    assert.strictEqual(decision.status, 200);
    assert.ok(destroyed.includes('express-session-xyz'));
});

test('handle retourne 200 quand aucune session correspondante n\'est trouvée', async () => {
    const bc = createBackchannel({
        sessionStore: buildFakeStore().store,
        jwksUri:      'https://kc.example.com/certs',
        _verify:      buildFakeVerify(VALID_DECODED),
    });

    // Aucun trackSession appelé — la map est vide
    const decision = await bc.handle({ body: { logout_token: 'token' } });

    assert.strictEqual(decision.status, 200);
});