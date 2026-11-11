/**
 * Role decisions shared by the UI. The backend repeats this check on every
 * privileged request. A role string typed into the browser is ignored.
 *
 * Claims come from a verified Firebase ID token:
 *   role: "admin" | "viewer" | "device", or admin: true
 * Missing claims are viewers. There is no client-side promotion path.
 */

export function roleFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return 'viewer';
  if (claims.admin === true || claims.role === 'admin') return 'admin';
  if (claims.role === 'device') return 'device';
  return 'viewer';
}

export function canViewMonitoring(role) {
  return role === 'admin' || role === 'viewer' || role === 'device';
}

export function canControlRover(role) {
  return role === 'admin';
}

export function canManageAccess(role) {
  return role === 'admin';
}
