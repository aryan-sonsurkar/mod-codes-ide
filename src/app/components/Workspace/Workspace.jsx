"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import Welcome from "./content/Welcome";
import IdeWorkspace from "./content/IDEWorkspace";
import { useState,useEffect } from "react";

export default function Workspace() {
  const [projects,setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
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
  function deleteProject(id) {
    const updatedProjects = projects.filter((currentProject) => {
        return currentProject.id!==id;
    });
    const localProjects = JSON.stringify(updatedProjects);
    localStorage.setItem("modcodes-projects",localProjects);
    setProjects(updatedProjects);
  }
  function openProject(id){
    const selectedProject = projects.find((currentProject) => {
        return currentProject.id===id;
    });

    if (!selectedProject) {
      return;
    }

    const updatedProjects = projects.map((currentProject) => {
      if (currentProject.id === id) {
        return {
          ...currentProject,
          lastOpened: Date.now(),
        };
      }
      return currentProject;
    });

    setSelectedProjectId(id);
    setProjects(updatedProjects);
    localStorage.setItem("modcodes-projects", JSON.stringify(updatedProjects));
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  return (
<div className="workspace">
  {selectedProjectId === null ? (
    <section className="workspace-content">
      <Welcome />
      <Quickactions openModal={openModal}/>
      <Recentprojects projects={projects} deleteProject={deleteProject} openProject={openProject}/>
    </section>
  ) : (
    <IdeWorkspace selectedProject={selectedProject} />
  )}

  <ChatInput />

  {isModalOpen && <CreateProjectModal closeModal={closeModal} addProject={addProject} />}
</div>
  );
}