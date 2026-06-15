const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createAuthorizationCode = require('../../../src/handlers/authCode');
const { buildFakeAuthClient, makeJwt } = require('../support/builders');

/** Stratégie authCode avec dépendances par défaut, surchargeables par test. */
function buildStrategy(overrides = {}) {
    return createAuthorizationCode({
        client:      buildFakeAuthClient(),
        config:      {},
        clientId:    'c',
        redirectUri: '/callback',
        ...overrides,
    });
}

test('createAuthorizationCode retourne un objet avec authenticate, startLogin et handleCallback', () => {
    const strategy = createAuthorizationCode({});
    assert.strictEqual(typeof strategy.authenticate,   'function');
    assert.strictEqual(typeof strategy.startLogin,     'function');
    assert.strictEqual(typeof strategy.handleCallback, 'function');
});

// ---- authenticate -----------------------------------------------------------

test('authenticate redirige vers /login quand la session est vide', async () => {
    const strategy = createAuthorizationCode({});
    const decision = await strategy.authenticate({});

    assert.strictEqual(decision.type, 'redirect');
    assert.strictEqual(decision.url,  '/login');
});

test('authenticate retourne allow si session.user existe, sans vérifier les rôles', async () => {
    const strategy = buildStrategy();

    const decision = await strategy.authenticate({
        session: { user: { roles: ['reader'], sid: 'abc' } },
        headers: {},
    });

    assert.equal(decision.type, 'allow');
    assert.deepEqual(decision.principal, { roles: ['reader'], sid: 'abc' });
});

// ---- startLogin --------------------------------------------------------------

test('startLogin retourne une décision de type redirect', async () => {
    const strategy = buildStrategy();
    const decision = await strategy.startLogin({ session: {} });

    assert.strictEqual(decision.type, 'redirect');
});

test('startLogin construit l\'url via buildAuthorizationUrl', async () => {
    const fakeUrl  = new URL('https://kc.example.com/authorize');
    const strategy = buildStrategy({
        client: buildFakeAuthClient({ buildAuthorizationUrl: () => fakeUrl }),
    });
    const decision = await strategy.startLogin({ session: {} });

    assert.strictEqual(decision.url, fakeUrl.href);
});

test('startLogin stocke codeVerifier et state dans la session', async () => {
    const strategy = buildStrategy();
    const session  = {};
    await strategy.startLogin({ session });

    assert.strictEqual(session.pkce.codeVerifier, 'verifier-abc');
    assert.strictEqual(session.pkce.state,        'state-123');
});

// ---- handleCallback -------------------------------------------------------------

test('handleCallback retourne une décision de type session', async () => {
    const strategy = buildStrategy();
    const session  = { pkce: { codeVerifier: '', state: '' } };
    const decision = await strategy.handleCallback({ session });

    assert.strictEqual(decision.type, 'session');
});

test('handleCallback retourne allow sans vérifier les rôles', async () => {
    const strategy = buildStrategy({
        _decode: () => ({
            resource_access: { c: { roles: ['reader'] } },
            sid: 'kc-sid',
        }),
    });

    const session  = { pkce: { codeVerifier: 'verifier-abc', state: 'state-123' } };
    const decision = await strategy.handleCallback({
        session,
        url: new URL('http://app/callback?code=abc&state=state-123'),
    });

    assert.equal(decision.type, 'session');
});

test('handleCallback stocke le principal dans la session pour l\'échange de code & doit la nettoyer ensuite', async () => {
    const accessToken = makeJwt({
        sub:             'user-123',
        resource_access: { 'mon-app': { roles: ['admin'] } },
    });

    const strategy = buildStrategy({
        clientId: 'mon-app',
        client:   buildFakeAuthClient({
            authorizationCodeGrant: async () => ({ access_token: accessToken }),
        }),
    });

    const session = { pkce: { codeVerifier: 'verifier-abc', state: 'state-123' } };
    await strategy.handleCallback({
        session,
        url: new URL('https://app.example.com/callback?code=abc&state=state-123'),
    });

    assert.strictEqual(session.user.sub, 'user-123');
    assert.deepStrictEqual(session.user.roles, ['admin']);
    assert.strictEqual(session.pkce, undefined);
});

// Le sid sert de clé au backchannel logout. La spec OIDC le porte dans
// l'ID token — l'access token n'est pas garanti de le contenir.
test('handleCallback prend le sid depuis l\'id_token quand l\'access_token ne l\'a pas', async () => {
    const strategy = buildStrategy({
        client: buildFakeAuthClient({
            authorizationCodeGrant: async () => ({
                access_token: makeJwt({ sub: 'user-123' }),          // pas de sid
                id_token:     makeJwt({ sid: 'kc-sid-du-id-token' }),
            }),
        }),
    });

    const session = { pkce: { codeVerifier: 'verifier-abc', state: 'state-123' } };
    await strategy.handleCallback({
        session,
        url: new URL('https://app.example.com/callback?code=abc&state=state-123'),
    });

    assert.strictEqual(session.user.sid, 'kc-sid-du-id-token');
});

test('handleCallback garde le sid de l\'access_token en l\'absence d\'id_token', async () => {
    const strategy = buildStrategy({
        client: buildFakeAuthClient({
            authorizationCodeGrant: async () => ({
                access_token: makeJwt({ sub: 'user-123', sid: 'kc-sid-access' }),
            }),
        }),
    });

    const session = { pkce: { codeVerifier: 'verifier-abc', state: 'state-123' } };
    await strategy.handleCallback({
        session,
        url: new URL('https://app.example.com/callback?code=abc&state=state-123'),
    });

    assert.strictEqual(session.user.sid, 'kc-sid-access');
});
