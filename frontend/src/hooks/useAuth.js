import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

/** Current Firebase user. `loading` is true until the persisted session is resolved. */
export function useAuth() {
  const [state, setState] = useState({ user: null, loading: Boolean(auth) });

  useEffect(() => {
    if (!auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => setState({ user, loading: false }));
    return unsubscribe;
  }, []);

  return state;
}
