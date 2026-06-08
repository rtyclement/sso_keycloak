const {test} = require("node:test");
const assert = require('node:assert/strict');
const {createSso} = require('../core');

test('createSso échoue si issuerURL est absent', async () => {
    await assert.rejects(
        createSso({
            clientId: 'a', clientSecret: 'b', sessionStore: {}, requireRole:'admin'
        }),'/issuerUrl/' //regex d'erreur
    )
})

test('createSso échoue si clientId est absent', async () => {
    await assert.rejects(
        createSso({
            issuerUrl:'http://blabla.com', clientSecret: 'b', sessionStore: {}, requireRole:'admin'
        }),'/clientId/' //regex d'erreur
    )
})

test('createSso échoue si clientSecret est absent', async () => {
    await assert.rejects(
        createSso({
            issuerUrl:'http://blabla.com', clientId: 'b', sessionStore: {}, requireRole:'admin'
        }),'/clientSecret/' //regex d'erreur
    )
})

test('createSso échoue si sessionStore est absent', async () => {
    await assert.rejects(
        createSso({
            issuerUrl:'http://blabla.com', clientId: 'b', clientSecret: 'a', requireRole:'admin'
        }),'/sessionStore/' //regex d'erreur
    )
})

test('createSso échoue si requireRole est absent', async () => {
    await assert.rejects(
        createSso({
            issuerUrl:'http://blabla.com', clientId: 'b', clientSecret: 'a', sessionStore:{}
        }),'/requireRole/' //regex d'erreur
    )
})

// --- Incrément 2 -----------------------//

const {FAKE_METADATA, BASE_OPTIONS, buildFakeClient, } = require("./Helper.test");

test('createSso retourne les métadonnées issues de la discovery', async () => {
    const sso = await createSso({ ...BASE_OPTIONS, _client: buildFakeClient() });
    assert.deepStrictEqual(sso.metadata, FAKE_METADATA);
});

test('createSso appelle discovery avec l\'issuerUrl, le clientId et le clientSecret', async () => {
    let capturedArgs;
    const fakeClient = buildFakeClient({ onDiscovery: (args) => { capturedArgs = args; } });

    await createSso({ ...BASE_OPTIONS, _client: fakeClient });

    assert.strictEqual(capturedArgs.url.href, 'https://kc.example.com/realms/myrealm');
    assert.strictEqual(capturedArgs.clientId, 'mon-app');
    assert.strictEqual(capturedArgs.clientSecret, 'secret-123');
});

// --- Incrément 3 -----------------------//

test('createSso retourne une stratégie authorizationCode', async () => {
    const fakeStrategy = { authenticate: async () => ({}) };

    const sso = await createSso({
        ...BASE_OPTIONS,
        _client:    buildFakeClient(),
        _factories: { authorizationCode: () => fakeStrategy },
    });

    assert.strictEqual(sso.strategies.authorizationCode, fakeStrategy);
});