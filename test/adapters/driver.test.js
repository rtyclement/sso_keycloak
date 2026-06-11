const { test } = require('node:test');
const assert   = require('node:assert/strict');
const DriverContrat   = require('../../src/adapters/DriverContrat');

test('Driver est une classe', () => {
    assert.equal(typeof DriverContrat, 'function');
});

test('chaque méthode du contrat throw si non implémentée', () => {
    const d = new DriverContrat();
    assert.throws(() => d.getSession({}),      /not implemented/i);
    assert.throws(() => d.getHeaders({}),      /not implemented/i);
    assert.throws(() => d.getBody({}),         /not implemented/i);
    assert.throws(() => d.getUrl({}),          /not implemented/i);
    assert.throws(() => d.getSessionId({}),    /not implemented/i);
    assert.throws(() => d.setPrincipal({}, {}), /not implemented/i);
    assert.throws(() => d.redirect({}, '/'),   /not implemented/i);
    assert.throws(() => d.deny({}, 403),       /not implemented/i);
    assert.throws(() => d.ok({}),              /not implemented/i);
    assert.throws(() => d.wrap(() => {}),      /not implemented/i);
    assert.throws(() => d.install({}, '/', () => {}), /not implemented/i);
});

test('une sous-classe qui implémente ne throw pas', () => {
    class FakeDriver extends DriverContrat {
        getSession()   { return {}; }
        getHeaders()   { return {}; }
        getBody()      { return {}; }
        getUrl()       { return new URL('http://x/'); }
        getSessionId() { return 'id'; }
        setPrincipal() {}
        redirect()     {}
        deny()         {}
        ok()           {}
        wrap(logic)    { return logic; }
        install()      {}
    }
    const d = new FakeDriver();
    assert.doesNotThrow(() => d.getSession({}));
    assert.doesNotThrow(() => d.wrap(() => {}));
    assert.doesNotThrow(() => d.install({}, '/', () => {}));
});