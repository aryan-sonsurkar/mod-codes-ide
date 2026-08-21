"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import IdeWorkspace from "./content/IDEWorkspace";
import ProjectsPage from "../Projects/ProjectsPage";
import { useState } from "react";
import { loadWorkspace } from "../../lib/workspace/workspaceStorage";
import { useToast } from "../../contexts/ToastContext";
import Onboarding, { isOnboardingCompleted } from "../Onboarding/Onboarding";

function loadProjects() {
  try {
    const savedProjects = localStorage.getItem("modcodes-projects");
    return savedProjects === null ? [] : JSON.parse(savedProjects);
  } catch (error) {
    return [];
  }
}

export default function Workspace() {
  const [projects, setProjects] = useState(loadProjects);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => loadWorkspace()?.projectId || null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingCompleted());

  const { toast } = useToast();

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
    toast(`Project "${project.name}" created`, "success");
    closeModal();
  };
  function deleteProject(id) {
    const deleted = projects.find((currentProject) => currentProject.id === id);
    const updatedProjects = projects.filter((currentProject) => {
        return currentProject.id!==id;
    });
    const localProjects = JSON.stringify(updatedProjects);
    localStorage.setItem("modcodes-projects",localProjects);
    setProjects(updatedProjects);
    if (id === selectedProjectId) {
      setSelectedProjectId(null);
    }
    if (deleted) {
      toast(`Deleted "${deleted.name}"`, "info");
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

  function toggleFavorite(id) {
    const updatedProjects = projects.map((currentProject) => {
      if (currentProject.id === id) {
        return {
          ...currentProject,
          favorite: !currentProject.favorite,
        };
      }
      return currentProject;
    });
    setProjects(updatedProjects);
    localStorage.setItem("modcodes-projects", JSON.stringify(updatedProjects));
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  return (
<div className="workspace">
  {showOnboarding && (
    <Onboarding
      onComplete={() => setShowOnboarding(false)}
      onSkip={() => setShowOnboarding(false)}
    />
  )}
  {selectedProject ? (
    <IdeWorkspace selectedProject={selectedProject} />
  ) : (
    <section className="workspace-content">
      <ProjectsPage
        projects={projects}
        onOpen={openProject}
        onDelete={deleteProject}
        onCreate={openModal}
        onToggleFavorite={toggleFavorite}
      />
    </section>
  )}

  <ChatInput />

  {isModalOpen && <CreateProjectModal closeModal={closeModal} addProject={addProject} />}
</div>
  );
}