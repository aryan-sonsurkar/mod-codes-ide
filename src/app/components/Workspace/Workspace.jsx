"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import Quickactions from "./content/Quick-actions";
import Recentprojects from "./content/Recent-projects";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import Welcome from "./content/Welcome";
import IdeWorkspace from "./content/IDEWorkspace";
import { useState,useEffect } from "react";
import { loadWorkspace } from "../../lib/workspace/workspaceStorage";

export default function Workspace() {
  const [projects,setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => loadWorkspace()?.projectId || null
  );
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
    if (id === selectedProjectId) {
      setSelectedProjectId(null);
    }
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

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  return (
<div className="workspace">
  {selectedProject ? (
    <IdeWorkspace selectedProject={selectedProject} />
  ) : (
    <section className="workspace-content">
      <Welcome />
      <Quickactions openModal={openModal}/>
      <Recentprojects projects={projects} deleteProject={deleteProject} openProject={openProject}/>
    </section>
  )}

  <ChatInput />

  {isModalOpen && <CreateProjectModal closeModal={closeModal} addProject={addProject} />}
</div>
  );
}