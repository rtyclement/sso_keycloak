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

test('FASTIFY.install ajoute un hook onRequest', () => {
    const calls = [];
    const app   = { addHook: (name, fn) => calls.push({ name, fn }) };
    const handler = () => {};

    DRIVERS.FASTIFY.install(app, null, handler);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'onRequest');
});

test('FASTIFY.install filtre les routes si fourni', async () => {
    const hooks = [];
    const app   = { addHook: (name, fn) => hooks.push(fn) };
    const calls = [];
    const handler = async (req, reply) => calls.push(req.url);

    DRIVERS.FASTIFY.install(app, '/api', handler);

    const hook = hooks[0];

    // matche → handler appelé
    await hook({ url: '/api' }, {});
    assert.equal(calls.length, 1);

    // ne matche pas → handler non appelé
    await hook({ url: '/autre' }, {});
    assert.equal(calls.length, 1);   // toujours 1
});