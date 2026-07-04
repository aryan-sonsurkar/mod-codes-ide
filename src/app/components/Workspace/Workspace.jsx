"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import Welcome from "./content/Welcome";
import { useState } from "react";

export default function Workspace() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  function openModal(){
    setIsModalOpen(true);
  };
  function closeModal(){
    setIsModalOpen(false);
  };
  return (
<div className="workspace">
  <section className="workspace-content">
    <Welcome />
    <Quickactions openModal={openModal}/>
    <Recentprojects />
  </section>
    <ChatInput />

  {isModalOpen && <CreateProjectModal closeModal={closeModal}/>}
</div>
  );
}