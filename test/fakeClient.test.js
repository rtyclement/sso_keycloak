const FAKE_METADATA = {
    introspection_endpoint: 'https://kc.example.com/realms/r/protocol/openid-connect/token/introspect',
    jwks_uri:               'https://kc.example.com/realms/r/protocol/openid-connect/certs',
};

function buildFakeClient({ onDiscovery } = {}) {
    return {
        discovery: async (url, clientId, clientSecret) => {
            if (onDiscovery) onDiscovery({ url, clientId, clientSecret });
            return { serverMetadata: () => FAKE_METADATA };
        },
    };
}
const BASE_OPTIONS = {
    issuerUrl:    'https://kc.example.com/realms/myrealm',
    clientId:     'mon-app',
    clientSecret: 'secret-123',
    sessionStore: {},
    requiredRole: 'admin',
};

module.exports = {FAKE_METADATA, BASE_OPTIONS, buildFakeClient};