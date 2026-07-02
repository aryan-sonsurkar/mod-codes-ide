import Sidebar from "./components/Sidebar/Sidebar";
import Workspace from "./components/Workspace/Workspace";

export default function Home() {
  return (
    <div className="app">
    <Sidebar />
    <Workspace />
    </div>
  );
}