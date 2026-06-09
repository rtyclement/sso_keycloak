const { test } = require('node:test');
const assert   = require('node:assert/strict');
const createExpressBearerSso = require('../../../src/factories/express/express-bearer');

test('échoue si issuerUrl est absent',    () => assert.throws(() => createExpressBearerSso({}, {}), /issuerUrl/i));
test('échoue si clientId est absent',     () => assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x' }), /clientId/i));
test('échoue si clientSecret est absent', () => assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x', clientId: 'y' }), /clientSecret/i));
test('échoue si requiredRole est absent', () => assert.throws(() => createExpressBearerSso({}, { issuerUrl: 'x', clientId: 'y', clientSecret: 'z' }), /requiredRole/i));