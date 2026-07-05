"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import Welcome from "./content/Welcome";
import { useState,useEffect } from "react";

export default function Workspace() {
  const [projects,setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  function openModal(){
    setIsModalOpen(true);
  };
  function closeModal(){
    setIsModalOpen(false);
  };
  function addProject(project){
    const updatedProjects = [
        ...projects,
        project
    ];
    const localProjects = JSON.stringify(updatedProjects);
    localStorage.setItem("modcodes-projects",localProjects);
    setProjects(updatedProjects);
    closeModal();
  };
  useEffect(() => {
    const savedProjects = localStorage.getItem("modcodes-projects");
    if (savedProjects === null){
      
    }
    else {
      const loadedprojects = JSON.parse(savedProjects);
      setProjects(loadedprojects);
    }
  }, []);
  return (
<div className="workspace">
  <section className="workspace-content">
    <Welcome />
    <Quickactions openModal={openModal}/>
    <Recentprojects projects={projects}/>
  </section>
    <ChatInput />

  {isModalOpen && <CreateProjectModal closeModal={closeModal} addProject={addProject}/>}
</div>
  );
}