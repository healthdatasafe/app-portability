/*
 * Empty stub for Node built-ins that pryv / pryv-account-backup import at
 * module-evaluation time but never call from browser code paths.
 *
 * Wired via vite.config.ts `resolve.alias`. Mirrors the upstream
 * pryv-account-backup-webapp/src/lib/node-stub.js approach (which uses
 * esbuild aliases for the same modules).
 *
 * Affected modules: fs, path, https, http, crypto, stream.
 */
export default {};
