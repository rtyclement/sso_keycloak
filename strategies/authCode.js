const jwt = require('jsonwebtoken')

function createAuthorizationCode(deps) {
    return {
        authenticate: async (ctx) => {
            if (!ctx.session?.user) {
                return { type: 'redirect', url: '/login' };
            }
            if (!ctx.session.user.roles?.includes(deps.requiredRole)){
                return { type: 'deny', status: 403, reason: 'missing_role' };
            }
            return { type: 'allow', principal: ctx.session.user };
        },
        startLogin: async (ctx) => { 
            const codeVerifier  = deps.client.randomPKCECodeVerifier();
            const codeChallenge = await deps.client.calculatePKCECodeChallenge(codeVerifier);
            const state         = deps.client.randomState();
            const url           = deps.client.buildAuthorizationUrl(deps.config, {
                redirect_uri:          deps.redirectUri,
                scope:                 'openid profile',
                code_challenge:        codeChallenge,
                code_challenge_method: 'S256',
                state,
            });
            ctx.session.pkce = {codeVerifier, state}
            return {type: 'redirect', url: url.href };
        },
        handleCallback: async (ctx) => {
        const tokens  = await deps.client.authorizationCodeGrant(
                deps.config,
                ctx.url,
                { pkceCodeVerifier: ctx.session.pkce.codeVerifier, expectedState: ctx.session.pkce.state },
            );
            const claims    = jwt.decode(tokens.access_token);
            const roles     = claims?.resource_access?.[deps.clientId]?.roles ?? [];
            const principal = { ...claims, roles };

            ctx.session.user = principal;
            return { type: 'session', principal, redirectTo: '/' };
        },
    };
}

module.exports = createAuthorizationCode;