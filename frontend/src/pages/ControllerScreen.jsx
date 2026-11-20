import Header from '../components/layout/Header';
import LogoutButton from '../components/auth/LogoutButton';
import Cockpit from '../components/operate/Cockpit';

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
      <main className="mx-auto max-w-7xl px-4 py-4">
        <Cockpit />
      </main>
    </div>
  );
}
