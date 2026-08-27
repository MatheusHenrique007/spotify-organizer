import Sidebar from './Sidebar.jsx';

export default function AppShell({ authenticated, children }) {
  return (
    <div className="app-shell">
      <Sidebar authenticated={authenticated} />
      <main className="app-main">{children}</main>
    </div>
  );
}
