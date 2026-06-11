const realClient = require('openid-client'); 

function required(options, key) {
    if (options[key] === undefined || options[key] === null) {
        throw new Error(`[sso_keycloak] Option obligatoire manquante : "${key}"`);
    }
    return options[key];
}
async function createSso(options = {}) {
    required(options, 'issuerUrl');
    required(options, 'clientId');
    required(options, 'clientSecret');
    required(options, 'requiredRole');
    const client = options._client ?? realClient;

    const discoveryOptions = options.allowHttp
    ? { execute: [client.allowInsecureRequests] }
    : {};

    const config   = await client.discovery(
        new URL(options.issuerUrl),
        options.clientId,
        options.clientSecret,
        undefined,
        discoveryOptions,
    );
    const metadata = config.serverMetadata();

    const factories = options._factories ?? {};
    const createAuthorizationCode = factories.authorizationCode ?? require('./handlers/authCode');
    const createInstrospection = factories.introspection ?? require('./handlers/introspection');
    const createBackchannel = factories.backchannel ?? require('./handlers/backchannel');

    const strategies = {
        authorizationCode: createAuthorizationCode({
            client,config,
            redirectUri:  options.redirectUri,
            sessionStore: options.sessionStore,
            clientId:     options.clientId,
            requiredRole: options.requiredRole,
        }),
        introspection: createInstrospection({
            introspectUrl:    metadata.introspection_endpoint,
            clientId:         options.introspection?.clientId     ?? options.clientId,
            clientSecret:     options.introspection?.clientSecret ?? options.clientSecret,
            audienceClientId: options.clientId,
            requiredRole:     options.requiredRole,
        }),
    };

    const backchannel = createBackchannel({
        sessionStore: options.sessionStore,
        jwksUri: metadata.jwks_uri,
    });

    return {metadata,strategies,backchannel};
};

module.exports = {createSso};