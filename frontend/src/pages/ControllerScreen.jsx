import { lazy, Suspense } from 'react';
import Header from '../components/layout/Header';
import LogoutButton from '../components/auth/LogoutButton';
import LoadingState from '../components/layout/LoadingState';

const RoverControlPanel = lazy(() => import('../components/camera/RoverControlPanel'));

export default function ControllerScreen({ user, navigate }) {
  return (
    <div className="min-h-screen">
      <Header
        online={false}
        lastSeen={null}
        now={Date.now()}
        role="admin"
        navigate={navigate}
        link="controller"
        actions={<LogoutButton email={user.email} />}
      />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Suspense fallback={<div className="card"><LoadingState label="Loading controller…" /></div>}>
          <RoverControlPanel />
        </Suspense>
      </main>
    </div>
  );
}
