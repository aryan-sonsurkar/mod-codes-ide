import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";"./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";"./content/Recent-projects";
import Welcome from "./content/Welcome";"./content/Welcome";

export default function Workspace() {
  return (
<div className="workspace">
    <Welcome />
    <Quickactions />
    <Recentprojects />
    <ChatInput />
</div>
  );
}