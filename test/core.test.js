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

test('createSso échoue si clientId est absent', async () => {
    await assert.rejects(
        createSso({
            issuerUrl:'http://blabla.com', clientSecret: 'b', sessionStore: {}, requireRole:'admin'
        }),'/clientId/' //regex d'erreur
    )
})