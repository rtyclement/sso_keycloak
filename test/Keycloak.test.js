const { test } = require('node:test');
const assert   = require('node:assert/strict');
const Keycloak = require('../src/Keycloak');
const DRIVERS  = require('../src/adapters/Drivers');
const { makeFakeDriver }      = require('./support/fakeDriver');
const { buildKeycloakConfig } = require('./support/builders');

// ---- Construction --------------------------------------------------------

test('Keycloak est une classe instanciable', () => {
    assert.equal(typeof Keycloak, 'function');
});

test('Keycloak accepte tout driver instanceof DriverContrat', () => {
    const { driver } = makeFakeDriver();
    assert.doesNotThrow(() => new Keycloak(driver, buildKeycloakConfig()));
});

test('Keycloak accepte le driver EXPRESS', () => {
    assert.doesNotThrow(() => new Keycloak(DRIVERS.EXPRESS, buildKeycloakConfig()));
});

test('Keycloak accepte le driver FASTIFY', () => {
    assert.doesNotThrow(() => new Keycloak(DRIVERS.FASTIFY, buildKeycloakConfig()));
});

test('Keycloak échoue si le driver est absent', () => {
    assert.throws(() => new Keycloak(null, buildKeycloakConfig()), /driver/i);
});

test('Keycloak échoue si le driver n\'est pas un DriverContrat', () => {
    assert.throws(() => new Keycloak({ bidon: true }, buildKeycloakConfig()), /driver/i);
});

test('Keycloak échoue si config est absente', () => {
    assert.throws(() => new Keycloak(DRIVERS.EXPRESS), /config/i);
});

test('Le constructeur enregistre bien le driver choisi', () => {
    const kc = new Keycloak(DRIVERS.EXPRESS, buildKeycloakConfig());
    assert.equal(kc.getDriverType(), 'EXPRESS');
});

test('Keycloak appelle driver.createStore au constructeur', () => {
    const { driver, calls } = makeFakeDriver();
    new Keycloak(driver, buildKeycloakConfig());
    assert.equal(calls.createStore, 1);
});

test('Keycloak expose une méthode ready() qui retourne une Promise', () => {
    const { driver } = makeFakeDriver();
    const kc = new Keycloak(driver, buildKeycloakConfig());
    assert.ok(kc.ready() instanceof Promise);
});

test('ready() se résout sans erreur avec un client valide', async () => {
    const { driver } = makeFakeDriver();
    const kc = new Keycloak(driver, buildKeycloakConfig());
    await assert.doesNotReject(() => kc.ready());
});

// ---- API protect : validation des arguments ------------------------------

function buildKc(overrides) {
    const fake = makeFakeDriver();
    const kc   = new Keycloak(fake.driver, buildKeycloakConfig(overrides));
    return { kc, ...fake };
}

test('protect échoue si app est absent', () => {
    const { kc } = buildKc();
    assert.throws(() => kc.protect(null, '/api', 'bearer'), /app/i);
});

test('protect échoue si mode est absent', () => {
    const { kc } = buildKc();
    assert.throws(() => kc.protect({}, '/api', null), /mode/i);
});

test('protect échoue si mode est différent de session ou bearer', () => {
    const { kc } = buildKc();
    assert.throws(() => kc.protect({}, '/api', 'fizhfoiahf'), /mode/i);
    assert.throws(() => kc.protect({}, '/api', ''), /mode/i);
    assert.doesNotThrow(() => kc.protect({}, '/api', 'session'));
    assert.doesNotThrow(() => kc.protect({}, '/api', 'bearer'));
});

// ---- API protect : enregistrement des règles ------------------------------

test('protect enregistre une règle avec les bons champs', () => {
    const { kc } = buildKc();
    kc.protect({}, '/api', 'bearer');

    assert.equal(kc.getRules().length, 1);
    assert.equal(kc.getRule(0).mode, 'bearer');
    assert.ok(kc.getRule(0).patterns[0] instanceof RegExp);
});

test('protect accepte un tableau de routes', () => {
    const { kc } = buildKc();
    kc.protect({}, ['/api', '/data'], 'bearer');

    assert.equal(kc.getRules().length, 1);
    assert.equal(kc.getRule(0).patterns.length, 2);
});

test('protect empile les règles sans écraser', () => {
    const { kc } = buildKc();
    kc.protect({}, '/swagger', 'session');
    kc.protect({}, null, 'bearer');

    assert.equal(kc.getRules().length, 2);
    assert.equal(kc.getRule(0).mode, 'session');
    assert.equal(kc.getRule(1).mode, 'bearer');
});

test('protect accepte routes null — le pattern matche toute url', () => {
    const { kc } = buildKc();
    kc.protect({}, null, 'bearer');

    assert.equal(kc.getRule(0).patterns.length, 1);
    assert.ok(kc.getRule(0).patterns[0].test('/nimporte/quoi'));
    assert.ok(kc.getRule(0).patterns[0].test('/'));
    assert.ok(!kc.getRule(0).patterns[0].test('gnfngfngfn'));
});

test('protect enregistre les roles', () => {
    const { kc } = buildKc();
    kc.protect({}, '/api', 'bearer', ['admin', 'reader']);

    assert.deepEqual(kc.getRule(0).roles, ['admin', 'reader']);
});

test('protect normalise un role string en tableau', () => {
    const { kc } = buildKc();
    kc.protect({}, '/api', 'bearer', 'admin');

    assert.deepEqual(kc.getRule(0).roles, ['admin']);
});

test('protect sans roles stocke un tableau vide', () => {
    const { kc } = buildKc();
    kc.protect({}, '/api', 'bearer');

    assert.deepEqual(kc.getRule(0).roles, []);
});

test('getRules retourne une copie — modifier le résultat ne pollue pas l\'état interne', () => {
    const { kc } = buildKc();
    kc.protect({}, '/api', 'bearer');

    kc.getRules().push({ mode: 'session', patterns: [] });

    assert.equal(kc.getRules().length, 1);
});

test('protect appelle driver.install avec les patterns et un handler', () => {
    const { kc, calls } = buildKc();
    const app = {};

    kc.protect(app, '/api', 'bearer');

    assert.equal(calls.install.length, 1);
    assert.equal(calls.install[0].app, app);
    assert.equal(calls.install[0].patterns.length, 1);
    assert.ok(calls.install[0].patterns[0] instanceof RegExp);
    assert.equal(typeof calls.install[0].handler, 'function');
});
