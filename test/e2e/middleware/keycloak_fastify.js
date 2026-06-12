const { Keycloak, DRIVERS } = require('../../../src/index');

const kc = new Keycloak(DRIVERS.FASTIFY, {
    issuerUrl:     `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    clientId:      process.env.KEYCLOAK_CLIENT_ID,
    clientSecret:  process.env.KEYCLOAK_CLIENT_SECRET,
    redirectUri:   process.env.KEYCLOAK_REDIRECT_URI,
    sessionSecret: process.env.SESSION_SECRET,
    allowHttp:     process.env.KEYCLOAK_ALLOW_HTTP === 'true',
});

module.exports = kc;