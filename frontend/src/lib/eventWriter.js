import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { EVENTS_COLLECTION } from '../config/constants';

/**
 * Append an event document to Firestore.
 * Shape must match firestore.rules:
 *   { type, label, confidence|null, message, timestamp, clientTs, source, createdBy }
 */
export async function writeEvent({ type, label, confidence = null, message }) {
  if (!firestore || !auth?.currentUser) return;
  await addDoc(collection(firestore, EVENTS_COLLECTION), {
    type,
    label,
    confidence,
    message,
    timestamp: serverTimestamp(),
    clientTs: Date.now(),
    source: 'dashboard',
    createdBy: auth.currentUser.uid,
  });
}
