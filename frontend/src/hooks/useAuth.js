import { useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { roleFromClaims } from '../lib/rbac';
import { setControlRole } from '../lib/controlClient';

/**
 * Persisted Firebase session plus the role from verified token claims.
 * A missing claim is a viewer. The client never promotes itself.
 */
export function useAuth() {
  const [state, setState] = useState({
    user: null,
    role: null,
    loading: Boolean(auth),
    sessionError: null,
  });

  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setControlRole('viewer');
        setState({ user: null, role: null, loading: false, sessionError: null });
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        const role = roleFromClaims(token.claims);
        setControlRole(role);
        setState({ user, role, loading: false, sessionError: null });
      } catch {
        setControlRole('viewer');
        setState({ user, role: 'viewer', loading: false, sessionError: 'Session expired. Sign in again.' });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}
