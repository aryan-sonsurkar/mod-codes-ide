import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import Welcome from "./content/Welcome";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import { useState } from "react";

export default function Workspace() {
  const [IsModalOpen, setIsModalOpen] = useState(false);
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