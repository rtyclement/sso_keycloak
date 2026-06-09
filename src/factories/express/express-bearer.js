const client              = require('openid-client');
const Adapter             = require('../../adapters/Adapter');
const createIntrospection = require('../../handlers/introspection');

function required(value, name) {
    if (value === undefined || value === null)
        throw new Error(`[sso_keycloak/express-bearer] ${name} est obligatoire`);
    return value;
}

module.exports = function createExpressBearerSso(deps = {}, config = {}) {
    required(config.issuerUrl,    'config.issuerUrl');
    required(config.clientId,     'config.clientId');
    required(config.clientSecret, 'config.clientSecret');
    required(config.requiredRole, 'config.requiredRole');

    const adapter = new Adapter(Adapter.DRIVERS.EXPRESS);
    let guard     = null;

    const ready = (async () => {
        const options    = config.allowHttp ? { execute: [client.allowInsecureRequests] } : {};
        const oidcConfig = await client.discovery(
            new URL(config.issuerUrl),
            config.clientId,
            config.clientSecret,
            undefined,
            options,
        );
        const metadata = oidcConfig.serverMetadata();

        const strategy = createIntrospection({
            introspectUrl:    config.introspectUrl ?? metadata.introspection_endpoint,
            clientId:         config.clientId,
            clientSecret:     config.clientSecret,
            audienceClientId: config.clientId,
            requiredRole:     config.requiredRole,
            fetch:            deps.fetch,  // injectable pour les tests, globalThis.fetch en prod
        });

        guard = adapter.guard(strategy);
    })().catch(err => {
        console.error('[sso_keycloak/express-bearer] Init échouée :', err);
        process.exit(1);
    });

    return (req, res, next) => ready.then(() => guard(req, res, next)).catch(next);
};