import AuthGate from './components/auth/AuthGate';
import LogoutButton from './components/auth/LogoutButton';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <>
      <div className="app-backdrop" aria-hidden="true" />
      <AuthGate>
        {(user) => <Dashboard headerActions={<LogoutButton email={user.email} />} />}
      </AuthGate>
    </>
  );
}
