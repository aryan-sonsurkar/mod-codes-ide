import Sidebar from "../components/Sidebar/Sidebar";
import SettingsPage from "../components/Settings/SettingsPage";

export default function SettingsRoute() {
  return (
    <div className="app">
      <Sidebar />
      <SettingsPage />
    </div>
  );
}