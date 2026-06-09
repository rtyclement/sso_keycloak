const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createIntrospection = require('../../src/handlers/introspection');

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
    const fakeFetch = async () => ({
        json: async () => ({ active: false }),
    });

    const strategy = createIntrospection({
        introspectUrl: 'https://kc.example.com/introspect',
        clientId:      'mon-api',
        clientSecret:  'secret',
        fetch:         fakeFetch,
    });

    const decision = await strategy.authenticate({
        headers: { authorization: 'Bearer fake-token' },
    });

    assert.strictEqual(decision.type,   'deny');
    assert.strictEqual(decision.status, 401);
});

test('authenticate retourne deny quand le rôle est manquant', async () => {
    const fakeFetch = async () => ({
        json: async () => ({
            active:          true,
            resource_access: { 'mon-api': { roles: ['viewer'] } },
        }),
    });

    const strategy = createIntrospection({
        introspectUrl:    'https://kc.example.com/introspect',
        clientId:         'mon-api',
        clientSecret:     'secret',
        audienceClientId: 'mon-api',
        requiredRole:     'admin',
        fetch:            fakeFetch,
    });

    const decision = await strategy.authenticate({
        headers: { authorization: 'Bearer fake-token' },
    });

    assert.strictEqual(decision.type,   'deny');
    assert.strictEqual(decision.status, 403);
});

test('authenticate retourne allow quand le token est actif et le rôle présent', async () => {
    const introspectionData = {
        active:          true,
        sub:             'service-abc',
        resource_access: { 'mon-api': { roles: ['admin'] } },
    };
    const fakeFetch = async () => ({ json: async () => introspectionData });

    const strategy = createIntrospection({
        introspectUrl:    'https://kc.example.com/introspect',
        clientId:         'mon-api',
        clientSecret:     'secret',
        audienceClientId: 'mon-api',
        requiredRole:     'admin',
        fetch:            fakeFetch,
    });

    const decision = await strategy.authenticate({
        headers: { authorization: 'Bearer fake-token' },
    });

    assert.strictEqual(decision.type,      'allow');
    assert.strictEqual(decision.principal, introspectionData);
});