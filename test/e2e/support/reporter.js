/**
 * Sortie console du banc : bandeaux, résultats des sous-tests, diagnostics
 * d'échec et tableau de verdicts. Aucune logique de test ici, uniquement de
 * l'affichage.
 */
const { execSync } = require('node:child_process');
const { keycloak } = require('../config');

const SERVER_LOG_TAIL  = 40;   // lignes de log serveur affichées sur échec
const KEYCLOAK_LOG_TAIL = 5;   // lignes WARN/ERROR Keycloak affichées sur échec

/** Bandeau de section pour un framework. */
function printFrameworkBanner(name) {
    console.log(`\n══════════ ${name.toUpperCase()} ══════════`);
}

/** Une ligne ✓/✗ par sous-test, avec le détail (ou la 1ʳᵉ ligne d'erreur). */
function printSubtestResults(subs) {
    for (const sub of subs) {
        console.log(`  ${sub.ok ? '✓' : '✗'} ${sub.name.padEnd(8)} [${sub.code}] ${sub.ok ? sub.detail : ''}`);
        if (!sub.ok) console.log(`      └─ ${sub.detail.split('\n')[0]}`);
    }
}

/**
 * Sur échec : dernières lignes de log du serveur app (dont les warn de la lib)
 * puis les WARN/ERROR récents de Keycloak — de quoi diagnostiquer sans relancer.
 */
function printFailureDiagnostics(server) {
    const serverTail = server.getLogs().trim().split('\n').slice(-SERVER_LOG_TAIL);
    console.log(`  ── logs serveur (${SERVER_LOG_TAIL} dernières lignes) ──`);
    for (const line of serverTail) console.log(`  │ ${line}`);

    try {
        const keycloakTail = execSync(`docker logs --since 5m ${keycloak.container} 2>&1`, { shell: true, encoding: 'utf8' })
            .split('\n')
            .filter((line) => /WARN|ERROR/.test(line) && !/Unrecognized configuration/.test(line))
            .slice(-KEYCLOAK_LOG_TAIL);
        if (keycloakTail.length) {
            console.log('  ── logs Keycloak (WARN/ERROR récents) ──');
            for (const line of keycloakTail) console.log(`  │ ${line}`);
        }
    } catch { /* docker logs indisponible : tant pis */ }
}

/** Tableau final : un verdict VALIDE / INVALIDE par framework. */
function printVerdicts(results) {
    console.log('\n┌──────────────────────────── RÉSULTATS ────────────────────────────');
    for (const result of results) {
        const codes = result.subs.map((s) => `${s.name}:${s.ok ? 'ok' : s.code}`).join('  ');
        const verdict = result.ok ? 'VALIDE  ' : 'INVALIDE';
        console.log(`│ ${result.framework.toUpperCase().padEnd(8)} → ${verdict}   (${codes})`);
    }
    console.log('└───────────────────────────────────────────────────────────────────');
}

module.exports = { printFrameworkBanner, printSubtestResults, printFailureDiagnostics, printVerdicts };
