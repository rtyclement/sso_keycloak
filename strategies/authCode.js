function createAuthorizationCode(deps) {
    return {
        authenticate: async (ctx) => {
            if (!ctx.session?.user) {
                return { type: 'redirect', url: '/login' };
            }
            return {};
        },
    };
}

module.exports = createAuthorizationCode;