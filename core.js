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
    required(options, 'sessionStore');
    required(options, 'requiredRole');
    
    const client = options._client ?? realClient;

    const config = await client.discovery(new URL(options.issuerUrl), options.clientId, options.clientSecret);
    const metadata= config.serverMetadata();

    return {metadata};
};

module.exports = {createSso};