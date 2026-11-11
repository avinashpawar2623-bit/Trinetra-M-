import { lazy, Suspense, useEffect, useState } from 'react';
import AuthGate from './components/auth/AuthGate';
import LogoutButton from './components/auth/LogoutButton';
import Unauthorized from './components/auth/Unauthorized';
import Dashboard from './pages/Dashboard';
import { canControlRover } from './lib/rbac';

const ControllerScreen = lazy(() => import('./pages/ControllerScreen'));

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(event, to) {
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
    event?.preventDefault();
    if (window.location.pathname !== to) window.history.pushState({}, '', to);
    setPath(to);
  }

  return { path, navigate };
}

export default function App() {
  const { path, navigate } = usePath();

  return (
    <>
      <div className="app-backdrop" aria-hidden="true" />
      <AuthGate>
        {({ user, role, sessionError }) => {
          const actions = <LogoutButton email={user.email} />;
          if (path === '/control') {
            if (!canControlRover(role)) return <Unauthorized onBack={(event) => navigate(event, '/')} />;
            return (
              <Suspense fallback={null}>
                <ControllerScreen user={user} navigate={navigate} />
              </Suspense>
            );
          }
          return (
            <Dashboard
              headerActions={actions}
              role={role}
              navigate={navigate}
              sessionError={sessionError}
            />
          );
        }}
      </AuthGate>
    </>
  );
}
