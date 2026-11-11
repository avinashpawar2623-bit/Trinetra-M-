/** Server-side role mapping. Request JSON is intentionally not an input. */
export function roleFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return 'viewer';
  if (claims.admin === true || claims.role === 'admin') return 'admin';
  if (claims.role === 'device') return 'device';
  return 'viewer';
}

export function authenticateHeader(header, decoded) {
  if (!header || !header.startsWith('Bearer ') || header.slice(7).trim() === '') {
    const err = new Error('Authentication required');
    err.status = 401;
    throw err;
  }
  if (!decoded || !decoded.uid) {
    const err = new Error('Invalid session');
    err.status = 401;
    throw err;
  }
  if (decoded.exp && decoded.exp * 1000 <= Date.now()) {
    const err = new Error('Session expired');
    err.status = 401;
    throw err;
  }
  return { uid: decoded.uid, role: roleFromClaims(decoded) };
}
