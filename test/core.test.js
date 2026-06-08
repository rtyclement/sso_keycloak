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