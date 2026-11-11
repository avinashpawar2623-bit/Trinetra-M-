/**
 * Firebase Admin is loaded only when a real token must be checked.
 * Credentials stay in the server environment, never in the frontend.
 */
let adminApp;

async function adminAuth() {
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let creds;
      try {
        creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {
        const err = new Error('Firebase Admin credentials could not be read');
        err.status = 503;
        throw err;
      }
      adminApp = admin.initializeApp({ credential: admin.credential.cert(creds) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      adminApp = admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      const err = new Error('Firebase Admin is not configured');
      err.status = 503;
      throw err;
    }
  }
  return admin.auth(adminApp);
}

export async function verifyIdToken(token) {
  const auth = await adminAuth();
  try {
    const decoded = await auth.verifyIdToken(token, true);
    return { uid: decoded.uid, exp: decoded.exp, role: decoded.role, admin: decoded.admin === true };
  } catch (err) {
    const denied = new Error(err?.code === 'auth/id-token-expired' ? 'Session expired' : 'Invalid session');
    denied.status = 401;
    throw denied;
  }
}

export async function revokeUserSessions(uid) {
  const auth = await adminAuth();
  await auth.revokeRefreshTokens(uid);
}
