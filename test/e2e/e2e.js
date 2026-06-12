/**
 * Test end-to-end du module sso_keycloak, 100 % local.
 *
 *   1. docker compose up        → démarre + importe le realm Keycloak
 *   2. attente readiness        → discovery OIDC joignable
 *   3. pour CHAQUE framework (express, fastify), un serveur à la fois :
 *        a. spawn du serveur Node (session + bearer sur un port unique)
 *        b. sous-test BEARER   : password-grant → token → GET /api/info
 *        c. sous-test SESSION  : login form headless → cookie → GET /dashboard
 *        d. kill du serveur
 *   4. deux verdicts finaux (express / fastify), code de sortie ≠ 0 si échec.
 */
require('dotenv').config();

const { spawn }         = require('node:child_process');
const path             = require('node:path');
const axiosBase        = require('axios');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT      = Number(process.env.APP_PORT || 9090);
const APP       = `http://localhost:${PORT}`;
const APP_HOST  = `localhost:${PORT}`;
const ISSUER    = `${process.env.KEYCLOAK_AUTH_URL}/realms/${process.env.KEYCLOAK_REALM}`;
const TOKEN_URL = `${ISSUER}/protocol/openid-connect/token`;
const DISCOVERY = `${ISSUER}/.well-known/openid-configuration`;
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const SECRET    = process.env.KEYCLOAK_CLIENT_SECRET;
const USERNAME  = process.env.TEST_USERNAME;
const PASSWORD  = process.env.TEST_PASSWORD;
const NA_USER   = process.env.TEST_USERNAME_NOACCESS;
const NA_PASS   = process.env.TEST_PASSWORD_NOACCESS;
const TEAR_DOWN = process.argv.includes('--down');

const FRAMEWORKS = [
    { name: 'express', file: 'server_express.js' },
    { name: 'fastify', file: 'server_fastify.js' },
];

// ─── Petits utilitaires ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Échec d'une étape, porteur d'un code (HTTP ou 'ERR'). */
class StepFail extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
const expect = (cond, code, message) => { if (!cond) throw new StepFail(code, message); };

function sh(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
        p.on('error', reject);
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} → exit ${code}`))));
    });
}

async function poll(label, fn, { timeoutMs, intervalMs = 1000 }) {
    const deadline = Date.now() + timeoutMs;
    let lastErr;
    while (Date.now() < deadline) {
        try { if (await fn()) return; } catch (e) { lastErr = e; }
        await sleep(intervalMs);
    }
    throw new Error(`Timeout en attendant ${label}${lastErr ? ` (dernier: ${lastErr.message})` : ''}`);
}

// ─── 1/2. Keycloak ─────────────────────────────────────────────────────────────
async function startKeycloak() {
    console.log('▶ docker compose up -d (Keycloak + import du realm)…');
    await sh('docker', ['compose', 'up', '-d']);
    console.log('⏳ attente de la disponibilité de Keycloak (discovery OIDC)…');
    await poll('Keycloak', async () => {
        const r = await axiosBase.get(DISCOVERY, { timeout: 4000, validateStatus: () => true });
        return r.status === 200 && !!r.data.token_endpoint;
    }, { timeoutMs: 240_000, intervalMs: 3000 });
    console.log('✓ Keycloak prêt :', ISSUER, '\n');
}

// ─── 3a. Cycle de vie d'un serveur Node ────────────────────────────────────────
async function startServer(file) {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stdout.on('data', (d) => { logs += d; });
    child.stderr.on('data', (d) => { logs += d; });

    let exited = false;
    child.on('exit', () => { exited = true; });

    try {
        await poll('le serveur Node /health', async () => {
            if (exited) throw new Error(`le serveur s'est arrêté:\n${logs}`);
            const r = await axiosBase.get(`${APP}/health`, { timeout: 2000, validateStatus: () => true });
            return r.status === 200;
        }, { timeoutMs: 20_000, intervalMs: 500 });
    } catch (e) {
        child.kill('SIGKILL');
        throw e;
    }

    const stop = () => new Promise((resolve) => {
        if (exited) return resolve();
        child.once('exit', resolve);
        child.kill();
        setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* déjà mort */ } resolve(); }, 3000);
    });

    return { stop, getLogs: () => logs };
}

// ─── 3b. Sous-tests BEARER ─────────────────────────────────────────────────────
async function getToken(username, password) {
    const res = await axiosBase.post(TOKEN_URL, new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        client_secret: SECRET,
        username,
        password,
        scope: 'openid',
    }), { headers: { 'content-type': 'application/x-www-form-urlencoded' }, validateStatus: () => true });
    expect(res.status === 200, res.status, `password-grant (${username}) a échoué: ${JSON.stringify(res.data)}`);
    expect(!!res.data.access_token, 'ERR', 'access_token absent de la réponse token');
    return res.data.access_token;
}

// Utilisateur AVEC le rôle api-access → 200 (+ rôle), et 401 sans token.
async function bearerAllowSubtest() {
    const token = await getToken(USERNAME, PASSWORD);

    let res = await axiosBase.get(`${APP}/api/info`, {
        headers: { authorization: `Bearer ${token}` }, validateStatus: () => true,
    });
    expect(res.status === 200, res.status, `GET /api/info attendu 200, reçu ${res.status}`);
    expect(res.data?.message === 'ok', 'ERR', `corps inattendu: ${JSON.stringify(res.data)}`);
    expect((res.data?.user?.roles || []).includes('api-access'), 'ERR',
        `rôle 'api-access' absent du principal: ${JSON.stringify(res.data?.user?.roles)}`);

    res = await axiosBase.get(`${APP}/api/info`, { validateStatus: () => true });
    expect(res.status === 401, res.status, `GET /api/info sans token attendu 401, reçu ${res.status}`);

    return 'token OK, /api/info 200 + rôle api-access, 401 sans token';
}

// Utilisateur authentifié SANS le rôle api-access → 403.
async function bearerDenySubtest() {
    const token = await getToken(NA_USER, NA_PASS);
    const res = await axiosBase.get(`${APP}/api/info`, {
        headers: { authorization: `Bearer ${token}` }, validateStatus: () => true,
    });
    expect(res.status === 403, res.status,
        `GET /api/info (token valide mais rôle insuffisant) attendu 403, reçu ${res.status}`);
    return 'token valide, rôle insuffisant → 403';
}

// ─── 3c. Sous-test SESSION (flow navigateur headless) ──────────────────────────
function parseFormAction(html) {
    const m = html.match(/action="([^"]*login-actions\/authenticate[^"]*)"/i);
    return m ? m[1].replace(/&amp;/g, '&') : null;
}

// Client HTTP avec cookies « navigateur », mais qui IGNORE le flag Secure :
// Keycloak pose ses cookies de session en SameSite=None (donc Secure), que
// tough-cookie refuserait d'envoyer sur http://. En local/HTTP c'est légitime.
function makeCookieClient() {
    const cookies = new Map(); // name -> value
    const inst = axiosBase.create({ maxRedirects: 0, validateStatus: () => true });
    inst.interceptors.request.use((cfg) => {
        if (cookies.size) cfg.headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
        return cfg;
    });
    inst.interceptors.response.use((res) => {
        for (const sc of res.headers['set-cookie'] || []) {
            const pair = sc.split(';')[0];
            const i = pair.indexOf('=');
            if (i === -1) continue;
            const name = pair.slice(0, i).trim();
            const value = pair.slice(i + 1).trim();
            if (!value || value === 'deleted') cookies.delete(name);
            else cookies.set(name, value);
        }
        return res;
    });
    return inst;
}

// Exécute le flow de login navigateur (étapes A→E) et retourne un client
// authentifié (porteur du cookie de session). N'effectue PAS le contrôle de rôle.
async function sessionLogin(username, password) {
    const client = makeCookieClient();
    const get  = (url) => client.get(url);
    const abs  = (base, loc) => new URL(loc, base).href;

    // (A) route protégée → 302 /login
    let res = await get(`${APP}/dashboard`);
    expect(res.status === 302, res.status, `GET /dashboard attendu 302→/login, reçu ${res.status}`);
    expect(String(res.headers.location).includes('/login'), res.status,
        `redirection inattendue: ${res.headers.location}`);

    // (B) /login → 302 vers l'URL d'autorisation Keycloak
    res = await get(`${APP}/login`);
    expect(res.status === 302, res.status, `GET /login attendu 302→Keycloak, reçu ${res.status}`);
    let kcUrl = abs(APP, res.headers.location);
    expect(new URL(kcUrl).host !== APP_HOST, res.status, `/login ne pointe pas vers Keycloak: ${kcUrl}`);

    // (C) suit les 30x jusqu'à la page de login Keycloak (200 + formulaire)
    let html = null;
    for (let hop = 0; hop < 10 && kcUrl; hop++) {
        res = await get(kcUrl);
        if (res.status >= 300 && res.status < 400) {
            const next = new URL(res.headers.location, kcUrl);
            expect(next.host !== APP_HOST, res.status,
                'Keycloak a redirigé vers /callback sans login (session SSO résiduelle ?)');
            kcUrl = next.href; continue;
        }
        expect(res.status === 200, res.status, `page de login Keycloak attendu 200, reçu ${res.status}`);
        html = res.data; break;
    }
    const action = parseFormAction(String(html));
    expect(!!action, 'ERR', 'formulaire de login Keycloak introuvable (action manquante)');

    // (D) POST identifiants → 302 vers redirect_uri (/callback)
    res = await client.post(action, new URLSearchParams({ username, password }), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status === 302, res.status,
        `POST credentials attendu 302→/callback, reçu ${res.status} (identifiants refusés ?)`);
    const callbackUrl = abs(action, res.headers.location);
    expect(new URL(callbackUrl).host === APP_HOST, res.status,
        `Keycloak n'a pas redirigé vers l'app: ${callbackUrl}`);

    // (E) /callback côté app → échange du code, pose la session, 302 vers /
    res = await get(callbackUrl);
    expect(res.status === 302, res.status, `GET /callback attendu 302, reçu ${res.status}`);

    return { get };
}

// Utilisateur AVEC le rôle dashboard-access → 200 (+ rôle).
async function sessionAllowSubtest() {
    const { get } = await sessionLogin(USERNAME, PASSWORD);
    const res = await get(`${APP}/dashboard`);
    expect(res.status === 200, res.status, `GET /dashboard (authentifié) attendu 200, reçu ${res.status}`);
    expect((res.data?.user?.roles || []).includes('dashboard-access'), 'ERR',
        `rôle 'dashboard-access' absent du principal: ${JSON.stringify(res.data?.user?.roles)}`);
    return 'login form OK, /callback 302, /dashboard 200 + rôle dashboard-access';
}

// Utilisateur authentifié SANS le rôle dashboard-access → 403.
async function sessionDenySubtest() {
    const { get } = await sessionLogin(NA_USER, NA_PASS);
    const res = await get(`${APP}/dashboard`);
    expect(res.status === 403, res.status,
        `GET /dashboard (authentifié mais rôle insuffisant) attendu 403, reçu ${res.status}`);
    return 'login OK, rôle insuffisant → 403';
}

// ─── Orchestration d'un sous-test ──────────────────────────────────────────────
async function runSubtest(name, fn) {
    try {
        const detail = await fn();
        return { name, ok: true, code: 200, detail };
    } catch (e) {
        if (e instanceof StepFail) return { name, ok: false, code: e.code, detail: e.message };
        return { name, ok: false, code: 'ERR', detail: e.stack || e.message };
    }
}

// ─── Programme principal ───────────────────────────────────────────────────────
async function main() {
    await startKeycloak();

    const results = [];
    for (const fw of FRAMEWORKS) {
        console.log(`\n══════════ ${fw.name.toUpperCase()} ══════════`);
        let server;
        const subs = [];
        try {
            server = await startServer(fw.file);
            console.log('  serveur démarré, lancement des sous-tests…');
            subs.push(await runSubtest('bearer',       bearerAllowSubtest));
            subs.push(await runSubtest('bearer-403',   bearerDenySubtest));
            subs.push(await runSubtest('session',      sessionAllowSubtest));
            subs.push(await runSubtest('session-403',  sessionDenySubtest));
        } catch (e) {
            subs.push({ name: 'boot', ok: false, code: 'ERR', detail: e.message });
        } finally {
            if (server) await server.stop();
        }
        for (const s of subs) {
            console.log(`  ${s.ok ? '✓' : '✗'} ${s.name.padEnd(8)} [${s.code}] ${s.ok ? s.detail : ''}`);
            if (!s.ok) console.log(`      └─ ${s.detail.split('\n')[0]}`);
        }
        results.push({ framework: fw.name, subs, ok: subs.every((s) => s.ok) });
    }

    // ─── Verdicts finaux ───────────────────────────────────────────────────────
    console.log('\n┌──────────────────────────── RÉSULTATS ────────────────────────────');
    for (const r of results) {
        const codes = r.subs.map((s) => `${s.name}:${s.ok ? 'ok' : s.code}`).join('  ');
        console.log(`│ ${r.framework.toUpperCase().padEnd(8)} → ${r.ok ? 'VALIDE  ' : 'INVALIDE'}   (${codes})`);
    }
    console.log('└───────────────────────────────────────────────────────────────────');

    if (TEAR_DOWN) {
        console.log('\n▶ docker compose down…');
        await sh('docker', ['compose', 'down']);
    } else {
        console.log('\n(Keycloak reste lancé. `docker compose down` ou `node e2e.js --down` pour l\'arrêter.)');
    }

    process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.error('\nÉchec inattendu du runner e2e:', e); process.exit(2); });
