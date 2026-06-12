const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { createSso } = require('../../src/core');
const {
    FAKE_METADATA,
    buildSsoConfig,
    buildFakeClient,
    buildStubFactories,
    buildCapturingFactories,
} = require('./support/builders');

// ---- Validation de la config ------------------------------------------------

test('createSso échoue si issuerUrl est absent', async () => {
    await assert.rejects(createSso(buildSsoConfig({ issuerUrl: undefined })), /issuerUrl/i);
});

test('createSso échoue si clientId est absent', async () => {
    await assert.rejects(createSso(buildSsoConfig({ clientId: undefined })), /clientId/i);
});

test('createSso échoue si clientSecret est absent', async () => {
    await assert.rejects(createSso(buildSsoConfig({ clientSecret: undefined })), /clientSecret/i);
});

test('createSso ne plante pas si requiredRole est absent', async () => {
    await assert.doesNotReject(() => createSso(buildSsoConfig()));
});

// ---- Discovery ----------------------------------------------------------------

test('createSso retourne les métadonnées issues de la discovery', async () => {
    const sso = await createSso(buildSsoConfig());
    assert.deepStrictEqual(sso.metadata, FAKE_METADATA);
});

test('createSso appelle discovery avec l\'issuerUrl, le clientId et le clientSecret', async () => {
    let capturedArgs;
    const fakeClient = buildFakeClient({ onDiscovery: (args) => { capturedArgs = args; } });

    await createSso(buildSsoConfig({ _client: fakeClient }));

    assert.strictEqual(capturedArgs.url.href, 'https://kc.example.com/realms/myrealm');
    assert.strictEqual(capturedArgs.clientId, 'mon-app');
    assert.strictEqual(capturedArgs.clientSecret, 'secret-123');
});

// ---- Câblage des stratégies ----------------------------------------------------

test('createSso retourne une stratégie authorizationCode', async () => {
    const fakeStrategy = { authenticate: async () => ({}) };

    const sso = await createSso(buildSsoConfig({
        _factories: { ...buildStubFactories(), authorizationCode: () => fakeStrategy },
    }));

    assert.strictEqual(sso.strategies.authorizationCode, fakeStrategy);
});

test('createSso retourne une stratégie introspection', async () => {
    const fakeStrategy = { authenticate: async () => ({}) };

    const sso = await createSso(buildSsoConfig({
        _factories: { ...buildStubFactories(), introspection: () => fakeStrategy },
    }));

    assert.strictEqual(sso.strategies.introspection, fakeStrategy);
});

test('createSso retourne un handler backchannel', async () => {
    const fakeHandler = async () => {};

    const sso = await createSso(buildSsoConfig({
        _factories: { ...buildStubFactories(), backchannel: () => fakeHandler },
    }));

    assert.strictEqual(sso.backchannel, fakeHandler);
});

// ---- Dépendances injectées dans les factories ------------------------------------

test('la factory authorizationCode reçoit clientId, redirectUri, sessionStore', async () => {
    const f            = buildCapturingFactories();
    const sessionStore = { get: () => {}, destroy: () => {} };

    await createSso(buildSsoConfig({
        redirectUri: '/callback',
        sessionStore,
        _factories: f,
    }));

    const deps = f.received.authorizationCode;
    assert.strictEqual(deps.clientId,     'mon-app');
    assert.strictEqual(deps.redirectUri,  '/callback');
    assert.strictEqual(deps.sessionStore, sessionStore);
});

test('la factory introspection reçoit l\'endpoint issu des métadonnées', async () => {
    const f = buildCapturingFactories();
    await createSso(buildSsoConfig({ _factories: f }));

    assert.strictEqual(
        f.received.introspection.introspectUrl,
        FAKE_METADATA.introspection_endpoint,
    );
});

test('la factory backchannel reçoit le jwksUri issu des métadonnées', async () => {
    const f = buildCapturingFactories();
    await createSso(buildSsoConfig({ _factories: f }));

    assert.strictEqual(f.received.backchannel.jwksUri, FAKE_METADATA.jwks_uri);
});
