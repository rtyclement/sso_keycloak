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
    };
}

module.exports = createAuthorizationCode;