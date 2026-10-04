import { firebaseConfigError } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import LoadingState from '../layout/LoadingState';
import ErrorState from '../layout/ErrorState';
import LoginPage from './LoginPage';

/**
 * Protected-route equivalent for a single-page app: renders `children(user)`
 * only when signed in, otherwise the login page. Nothing that reads Firebase
 * data is mounted before authentication.
 */
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();

  if (firebaseConfigError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <ErrorState title="Firebase is not configured" message={firebaseConfigError} />
        </div>
      </main>
    );
  }

  if (loading) return <LoadingState label="Checking session…" fullScreen />;
  if (!user) return <LoginPage />;
  return children(user);
}
