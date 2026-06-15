const jwt = require('jsonwebtoken')

function createAuthorizationCode(deps) {
    return {
        authenticate: async (ctx) => {
            if (!ctx.session?.user) {
                return { type: 'redirect', url: '/login' };
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
            // Le sid (clé du backchannel logout) est porté par l'ID token
            // selon la spec OIDC ; l'access token n'est pas garanti de l'avoir.
            const idClaims  = tokens.id_token ? jwt.decode(tokens.id_token) : null;
            const principal = { ...claims, roles, sid: idClaims?.sid ?? claims?.sid };

            ctx.session.user = principal;
            delete ctx.session.pkce;
            return { type: 'session', principal, redirectTo: '/' };
        },
    };
}

module.exports = createAuthorizationCode;