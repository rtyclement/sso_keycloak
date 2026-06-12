const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { compilePattern, matchRule } = require('../src/Keycloak');

/**
 * Fonctions pures de routage — aucun driver, aucune config :
 * ces tests ne dépendent que de compilePattern et matchRule.
 */

// ---- compilePattern --------------------------------------------------------

test('compilePattern : null matche tout', () => {
    const re = compilePattern(null);
    assert.ok(re.test('/'));
    assert.ok(re.test('/api'));
    assert.ok(re.test('/api/users/42'));
});

test('compilePattern : route exacte', () => {
    const re = compilePattern('/swagger');
    assert.ok(re.test('/swagger'));
    assert.ok(!re.test('/swagger/'));
    assert.ok(!re.test('/swagger/ui'));
    assert.ok(!re.test('/other'));
});

test('compilePattern : glob /* inclut la base et les descendants', () => {
    const re = compilePattern('/swagger/*');
    assert.ok(re.test('/swagger'));
    assert.ok(re.test('/swagger/'));
    assert.ok(re.test('/swagger/ui'));
    assert.ok(re.test('/swagger/a/b/c'));
    assert.ok(!re.test('/other'));
    assert.ok(!re.test('/swaggerx'));
});

test('compilePattern : caractères spéciaux échappés', () => {
    const re = compilePattern('/api/v1');
    assert.ok(re.test('/api/v1'));
    assert.ok(!re.test('/apixv1'));
});

// ---- matchRule --------------------------------------------------------------

function buildRule(pattern, overrides = {}) {
    return { patterns: [compilePattern(pattern)], mode: 'bearer', roles: [], ...overrides };
}

test('matchRule retourne null si aucune règle', () => {
    assert.equal(matchRule([], '/api'), null);
});

test('matchRule retourne la première règle qui matche', () => {
    const rules = [
        buildRule('/swagger', { mode: 'session' }),
        buildRule(null,       { mode: 'bearer'  }),
    ];
    assert.equal(matchRule(rules, '/swagger').mode, 'session');
});

test('matchRule retourne la règle null si aucune route spécifique ne matche', () => {
    const rules = [
        buildRule('/swagger', { mode: 'session' }),
        buildRule(null,       { mode: 'bearer'  }),
    ];
    assert.equal(matchRule(rules, '/api/users').mode, 'bearer');
});

test('matchRule retourne null si aucune règle ne matche', () => {
    const rules = [buildRule('/swagger', { mode: 'session' })];
    assert.equal(matchRule(rules, '/api'), null);
});

test('matchRule prend le premier match — pas le suivant', () => {
    const rules = [
        buildRule('/api', { mode: 'session' }),
        buildRule('/api', { mode: 'bearer'  }),
    ];
    assert.equal(matchRule(rules, '/api'), rules[0]);
});

test('matchRule matche si au moins un pattern de la règle matche', () => {
    const rules = [
        { patterns: [compilePattern('/a'), compilePattern('/b')], mode: 'bearer', roles: [] },
    ];
    assert.ok(matchRule(rules, '/a'));
    assert.ok(matchRule(rules, '/b'));
    assert.equal(matchRule(rules, '/c'), null);
});
