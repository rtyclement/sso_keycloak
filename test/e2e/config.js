/**
 * Configuration centrale du banc e2e, dérivée de `.test.env`.
 * Tout le reste du code lit ces objets — aucun autre module ne touche
 * directement à `process.env`.
 */
require('dotenv').config({ path: ['.test.env'] });

const PORT = Number(process.env.APP_PORT || 9090);

/** Le serveur applicatif sous test (Express ou Fastify), exposé sur l'hôte. */
const app = {
    port: PORT,
    url:  `http://localhost:${PORT}`,
    host: `localhost:${PORT}`,
};

const AUTH_URL = process.env.KEYCLOAK_AUTH_URL;
const REALM    = process.env.KEYCLOAK_REALM;
const issuer   = `${AUTH_URL}/realms/${REALM}`;

/** Endpoints Keycloak utiles + nom du conteneur Docker (pour les logs). */
const keycloak = {
    authUrl:        AUTH_URL,
    realm:          REALM,
    issuerUrl:      issuer,
    tokenUrl:       `${issuer}/protocol/openid-connect/token`,
    discoveryUrl:   `${issuer}/.well-known/openid-configuration`,
    adminRealmUrl:  `${AUTH_URL}/admin/realms/${REALM}`,
    masterTokenUrl: `${AUTH_URL}/realms/master/protocol/openid-connect/token`,
    container:      'kc_e2e',
};

/** Le client confidentiel du realm de test. */
const client = {
    id:     process.env.KEYCLOAK_CLIENT_ID,
    secret: process.env.KEYCLOAK_CLIENT_SECRET,
};

/** Les comptes de test du realm importé. */
const users = {
    // a les rôles dashboard-access ET api-access
    withAccess:    { username: process.env.TEST_USERNAME,          password: process.env.TEST_PASSWORD },
    // authentifié mais sans aucun rôle d'accès → attendu : 403
    withoutAccess: { username: process.env.TEST_USERNAME_NOACCESS, password: process.env.TEST_PASSWORD_NOACCESS },
    // admin bootstrap de Keycloak (realm master)
    admin:         { username: process.env.KC_BOOTSTRAP_ADMIN_USERNAME || 'admin',
                     password: process.env.KC_BOOTSTRAP_ADMIN_PASSWORD || 'admin' },
};

/** Les frameworks testés, un serveur à la fois sur le même port. */
const frameworks = [
    { name: 'express', serverFile: 'server_express.js' },
    { name: 'fastify', serverFile: 'server_fastify.js' },
];

module.exports = {
    rootDir:  __dirname,          // racine test/e2e (résolution des chemins serveur)
    app,
    keycloak,
    client,
    users,
    frameworks,
    tearDown: process.argv.includes('--down'),
};
