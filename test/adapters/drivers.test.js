const { test } = require('node:test');
const assert   = require('node:assert/strict');
const DRIVERS  = require('../../src/adapters/Drivers');
const DriverContrat   = require('../../src/adapters/DriverContrat');

test('EXPRESS et FASTIFY sont des instances de DriverContrat', () => {
    assert.ok(DRIVERS.EXPRESS instanceof DriverContrat);
    assert.ok(DRIVERS.FASTIFY instanceof DriverContrat);
});

test('EXPRESS implémente tout le contrat sans throw', () => {
    const d = DRIVERS.EXPRESS;
    assert.doesNotThrow(() => d.getSession({ session: {} }));
    assert.doesNotThrow(() => d.wrap(() => {}));
    assert.equal(typeof d.install, 'function');
});

test('FASTIFY implémente tout le contrat sans throw', () => {
    const d = DRIVERS.FASTIFY;
    assert.doesNotThrow(() => d.getSession({ session: {} }));
    assert.doesNotThrow(() => d.wrap(() => {}));
    assert.equal(typeof d.install, 'function');
});

test('EXPRESS.install monte un middleware via app.use', () => {
    const calls = [];
    const app   = { use: (...a) => calls.push(a) };
    const handler = () => {};

    DRIVERS.EXPRESS.install(app, '/api', handler);

    assert.equal(calls.length, 1);
    // app.use('/api', handler) — routes passées en premier
    assert.equal(calls[0][0], '/api');
    assert.equal(calls[0][1], handler);
});

test('EXPRESS.install avec routes null monte globalement', () => {
    const calls = [];
    const app   = { use: (...a) => calls.push(a) };
    const handler = () => {};

    DRIVERS.EXPRESS.install(app, null, handler);

    // app.use(handler) — pas de chemin
    assert.equal(calls[0][0], handler);
});