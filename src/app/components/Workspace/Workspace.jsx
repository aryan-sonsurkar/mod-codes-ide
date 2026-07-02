import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import Welcome from "./content/Welcome";

export default function Workspace() {
  return (
<div className="workspace">
  <section className="workspace-content">
    <Welcome />
    <Quickactions />
    <Recentprojects />
  </section>
    <ChatInput />
</div>
  );
}