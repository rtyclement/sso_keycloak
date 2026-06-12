const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createIntrospection = require('../../../src/handlers/introspection');

/**
 * Stratégie introspection avec dépendances par défaut, surchargeables par test.
 * `introspectionResult` pilote la réponse du fetch fake.
 */
function buildStrategy({ introspectionResult = { active: true }, ...overrides } = {}) {
    return createIntrospection({
        introspectUrl:    'https://kc.example.com/introspect',
        clientId:         'c',
        clientSecret:     's',
        audienceClientId: 'c',
        fetch: async () => ({ json: async () => introspectionResult }),
        ...overrides,
    });
}

test('createIntrospection retourne un objet avec une méthode authenticate', () => {
    const strategy = createIntrospection({});
    assert.strictEqual(typeof strategy.authenticate, 'function');
});

test('authenticate retourne deny quand le header Authorization est absent', async () => {
    const strategy = createIntrospection({});
    const decision = await strategy.authenticate({ headers: {} });

    assert.strictEqual(decision.type,   'deny');
    assert.strictEqual(decision.status, 401);
});

test('authenticate retourne deny quand le token est inactif', async () => {
    const strategy = buildStrategy({ introspectionResult: { active: false } });

    const decision = await strategy.authenticate({
        headers: { authorization: 'Bearer fake-token' },
    });

    assert.strictEqual(decision.type,   'deny');
    assert.strictEqual(decision.status, 401);
});

test('introspection retourne allow sans vérifier les rôles', async () => {
    const strategy = buildStrategy({
        introspectionResult: {
            active:          true,
            resource_access: { c: { roles: ['reader'] } },
        },
    });

    const decision = await strategy.authenticate({
        session: {},
        headers: { authorization: 'Bearer token123' },
    });

    assert.equal(decision.type, 'allow');
});
