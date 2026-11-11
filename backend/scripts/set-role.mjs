/**
 * Trusted provisioning. Run on a machine that has Firebase Admin credentials.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/secure/serviceAccount.json \
 *     node scripts/set-role.mjs operator@example.com admin
 *
 * Roles: admin, viewer, device
 * The user must sign out and sign in again before the new claim is used.
 */
import admin from 'firebase-admin';

const [email, role] = process.argv.slice(2);
const ALLOWED = new Set(['admin', 'viewer', 'device']);

if (!email || !ALLOWED.has(role)) {
  console.error('Usage: node scripts/set-role.mjs <email> <admin|viewer|device>');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, { role });
console.log(`Set ${email} (${user.uid}) role=${role}. Ask them to sign in again.`);
