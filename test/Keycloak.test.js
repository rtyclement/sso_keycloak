const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');
const { compilePattern } = require('../src/Keycloak');
const { matchRule } = require('../src/Keycloak');

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
test('getRules retourne une copie — modifier le résultat ne pollue pas l\'état interne', () => {
    const kc = new Keycloak({ framework: 'express' });
    kc.protect({}, '/api', 'bearer');

    kc.getRules().push({ mode: 'session', patterns: [] });

    assert.equal(kc.getRules().length, 1);
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

test('protect empile les règles sans écraser', () => {
    const kc  = new Keycloak({ framework: 'express' });
    kc.protect({}, '/swagger', 'session');
    kc.protect({}, null, 'bearer');

    assert.equal(kc.getRules().length, 2);
    assert.equal(kc.getRule(0).mode, 'session');
    assert.equal(kc.getRule(1).mode, 'bearer');
});

test('protect accepte routes null', () => {
    const kc  = new Keycloak({ framework: 'express' });
    kc.protect({}, null, 'bearer');
    assert.equal(kc.getRule(0).patterns.length, 1);
    assert.ok(kc.getRule(0).patterns[0].test('/nimporte/quoi'));
    assert.ok(kc.getRule(0).patterns[0].test('/'));
    assert.ok(!kc.getRule(0).patterns[0].test('gnfngfngfn'));
});

test('protect enregistre les roles', () => {
    const kc  = new Keycloak({ framework: 'express' });
    kc.protect({}, '/api', 'bearer', ['admin', 'reader']);

    assert.deepEqual(kc.getRule(0).roles, ['admin', 'reader']);
});

test('protect normalise un role string en tableau', () => {
    const kc  = new Keycloak({ framework: 'express' });
    kc.protect({}, '/api', 'bearer', 'admin');

    assert.deepEqual(kc.getRule(0).roles, ['admin']);
});

test('protect sans roles stocke un tableau vide', () => {
    const kc  = new Keycloak({ framework: 'express' });
    kc.protect({}, '/api', 'bearer');

    assert.deepEqual(kc.getRule(0).roles, []);
});

test('matchRule retourne null si aucune règle', () => {
    assert.equal(matchRule([], '/api'), null);
});

test('matchRule retourne la première règle qui matche', () => {
    const rules = [
        { patterns: [compilePattern('/swagger')], mode: 'session', roles: [] },
        { patterns: [compilePattern(null)],       mode: 'bearer',  roles: [] },
    ];
    const match = matchRule(rules, '/swagger');
    assert.equal(match.mode, 'session');
});

test('matchRule retourne la règle null si aucune route spécifique ne matche', () => {
    const rules = [
        { patterns: [compilePattern('/swagger')], mode: 'session', roles: [] },
        { patterns: [compilePattern(null)],       mode: 'bearer',  roles: [] },
    ];
    const match = matchRule(rules, '/api/users');
    assert.equal(match.mode, 'bearer');
});

test('matchRule retourne null si aucune règle ne matche', () => {
    const rules = [
        { patterns: [compilePattern('/swagger')], mode: 'session', roles: [] },
    ];
    assert.equal(matchRule(rules, '/api'), null);
});

test('matchRule prend le premier match — pas le suivant', () => {
    const rules = [
        { patterns: [compilePattern('/api')], mode: 'session', roles: [] },
        { patterns: [compilePattern('/api')], mode: 'bearer',  roles: [] },
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