import Sidebar from "../components/Sidebar/Sidebar";

export default function AppLayout({ children }) {
  return (
    <div className="app">
      <Sidebar />
      {children}
    </div>
  );
}