const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');

test('Keycloak est une classe instanciable', () => {
    assert.equal(typeof Keycloak, 'function');
});

test('Keycloak échoue si framework est absent', () => {
    assert.throws(() => new Keycloak({}), /framework/i);
});

test('Keycloak échoue si framework est invalide', () => {
    assert.throws(() => new Keycloak({ framework: 'django' }), /framework/i);
});

test('Keycloak accepte express', () => {
    assert.doesNotThrow(() => new Keycloak({ framework: 'express' }));
});

test('Keycloak accepte fastify', () => {
    assert.doesNotThrow(() => new Keycloak({ framework: 'fastify' }));
});

test('Keycloak expose une méthode protect', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.equal(typeof kc.protect, 'function');
});

test('protect échoue si app est absent', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect(null, '/api', 'bearer'), /app/i);
});

test('protect échoue si mode est absent', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect({}, '/api', null), /mode/i);
});

test('protect échoue si mode est diffent de session ou bearer', () => {
    const kc = new Keycloak({ framework: 'express' });
    assert.throws(() => kc.protect({}, '/api', 'fizhfoiahf'), /mode/i);
    assert.throws(() => kc.protect({}, '/api', ''), /mode/i);
    assert.doesNotThrow(() => kc.protect({}, '/api', 'session'), /mode/i);
    assert.doesNotThrow(() => kc.protect({}, '/api', 'bearer'), /mode/i);
});

test('Le constructeur enregistre bien le framework choisi', () => {
    const kc = new Keycloak({framework: 'express'});
    assert.equal(kc.getFramework(),'express');
})

const { compilePattern } = require('../src/Keycloak');

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

test('Test getRules et getRule(index) retourne le tableau des regles à appliquer', () => {
    const kc = new Keycloak({framework: 'express'});
    kc._rules=[{
            mode: "bearer",
            patterns: ['/api','/flop']
        }];
    const rule=kc.getRule(0);
    assert.equal(rule.patterns[0],'/api');
    assert.equal(rule.patterns[1],'/flop');
    assert.equal(rule.mode,'bearer');
    assert.equal(kc.getRules().length,1);
    kc._rules.push({
            mode: "session",
            patterns: ['/user/*']
        })
    const rule2=kc.getRule(1);
    assert.equal(rule2.patterns[0],'/user/*');
    assert.equal(rule2.mode,'session');
    assert.equal(kc.getRules().length,2);
});

test('protect enregistre une règle avec les bons champs', () => {
    const kc  = new Keycloak({ framework: 'express' });
    const app = {};

    kc.protect(app, '/api', 'bearer');

    assert.equal(kc.getRules().length, 1);
    assert.equal(kc.getRule(0).mode, 'bearer');
    assert.ok(kc.getRule(0).patterns[0] instanceof RegExp);
});

test('protect accepte un tableau de routes', () => {
    const kc  = new Keycloak({ framework: 'express' });
    const app = {};

    kc.protect(app, ['/api', '/data'], 'bearer');

    assert.equal(kc.getRules().length, 1);
    assert.equal(kc.getRule(0).patterns.length, 2);
});