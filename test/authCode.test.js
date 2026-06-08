const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createAuthorizationCode = require('../strategies/authCode');

test('createAuthorizationCode retourne un objet avec une méthode authenticate', () => {
    const strategy = createAuthorizationCode({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});

test('authenticate redirige vers /login quand la session est vide', async () => {
    const strategy = createAuthorizationCode({});
    const decision = await strategy.authenticate({});

    assert.strictEqual(decision.type, 'redirect');
    assert.strictEqual(decision.url,  '/login');
});

test('authenticate retourne allow quand la session a un utilisateur avec le bon rôle', async () => {
    const user     = { sub: 'user-123', roles: ['admin'] };
    const strategy = createAuthorizationCode({ requiredRole: 'admin' });
    const decision = await strategy.authenticate({ session: { user } });

    assert.strictEqual(decision.type,      'allow');
    assert.strictEqual(decision.principal, user);
});

test('authenticate retourne deny quand la session a un utilisateur avec le mauvais rôle', async () => {
    const user     = { sub: 'user-123', roles: ['user'] };
    const strategy = createAuthorizationCode({ requiredRole: 'admin' });
    const decision = await strategy.authenticate({ session: { user } });

    assert.strictEqual(decision.type,      'deny');
    assert.strictEqual(decision.status, 403);
});

test('createAuthorizationCode retourne un objet avec une méthode startLogin', () => {
    const strategy = createAuthorizationCode({});
    assert.strictEqual(typeof strategy.startLogin, 'function');
});

const {buildFakeAuthClient} = require("./Helper.test")

test('startLogin retourne une décision de type redirect', async () => {
    const strategy = createAuthorizationCode({
        client:      buildFakeAuthClient(),
        config:      {},
        redirectUri: '/callback',
    });
    const decision = await strategy.startLogin({ session: {} });

    assert.strictEqual(decision.type, 'redirect');
});

test('startLogin construit l\'url via buildAuthorizationUrl', async () => {
    const fakeUrl    = new URL('https://kc.example.com/authorize');
    const strategy   = createAuthorizationCode({
        client:      buildFakeAuthClient({ buildAuthorizationUrl: () => fakeUrl }),
        config:      {},
        redirectUri: '/callback',
    });
    const decision = await strategy.startLogin({ session: {} });

    assert.strictEqual(decision.url, fakeUrl.href);
});