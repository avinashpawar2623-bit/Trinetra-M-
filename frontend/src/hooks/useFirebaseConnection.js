import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { firebaseConfigError, rtdb } from '../lib/firebase';

/** Firebase Realtime Database transport health, separate from rover telemetry. */
export function useFirebaseConnection() {
  const [state, setState] = useState(firebaseConfigError || !rtdb ? 'unconfigured' : 'connecting');

  useEffect(() => {
    if (!rtdb) return undefined;
    return onValue(ref(rtdb, '.info/connected'), (snapshot) => {
      setState(snapshot.val() === true ? 'connected' : 'disconnected');
    }, () => setState('disconnected'));
  }, []);

  return state;
}
