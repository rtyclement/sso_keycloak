const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { createSso } = require('../src/index');

test('createSso dispatche vers fastify (browser) quand framework=fastify ET session présente', () => {
    assert.throws(
        () => createSso(
            { session: {}, cookie: {}, formbody: {} },
            { framework: 'fastify' }
        ),
        /sessionSecret/i
    );
});

test('createSso dispatche vers fastify-bearer quand framework=fastify sans session', () => {
    assert.throws(
        () => createSso({}, { framework: 'fastify' }),
        /issuerUrl/i  // guard de fastify-bearer.js
    );
});

test('createSso lève une erreur si aucun framework reconnu', () => {
    assert.throws(() => createSso({}, {}), /framework/i);
});