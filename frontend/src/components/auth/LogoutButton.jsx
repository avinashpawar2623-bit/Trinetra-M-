import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export default function LogoutButton({ email }) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {email && <span className="hidden text-xs text-slate-400 sm:inline">{email}</span>}
      <button
        type="button"
        onClick={handleLogout}
        disabled={busy}
        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? 'Signing out…' : 'Log out'}
      </button>
    </div>
  );
}
