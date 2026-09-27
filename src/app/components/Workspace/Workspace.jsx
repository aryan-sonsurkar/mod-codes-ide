"use client";
import "./Workspace.css";
import ChatInput from "./chat-input";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import IdeWorkspace from "./content/IDEWorkspace";
import ProjectsPage from "../Projects/ProjectsPage";
import { useCallback, useRef, useState } from "react";
import { loadWorkspace } from "../../lib/workspace/workspaceStorage";
import { useToast } from "../../contexts/ToastContext";
import Onboarding, { isOnboardingCompleted } from "../Onboarding/Onboarding";
import { ProjectOpenAd } from "../Ads/AdContainer";

const ONBOARDING_PROVIDER_MAP = {
  ollama: "ollama",
  bonsai: "browser-bonsai",
};

function loadProjectsHydrated() {
  try {
    if (typeof localStorage === "undefined") return [];
    const saved = localStorage.getItem("modcodes-projects");
    return saved === null ? [] : JSON.parse(saved);
  } catch { return []; }
}

function loadProjectIdHydrated() {
  try {
    if (typeof localStorage === "undefined") return null;
    return loadWorkspace()?.projectId || null;
  } catch { return null; }
}

function loadOnboardingHydrated() {
  try {
    if (typeof localStorage === "undefined") return false;
    return !isOnboardingCompleted();
  } catch { return false; }
}

export default function Workspace() {
  const [projects, setProjects] = useState(loadProjectsHydrated);
  const [selectedProjectId, setSelectedProjectId] = useState(loadProjectIdHydrated);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(loadOnboardingHydrated);
  const askHandlerRef = useRef(null);

  const { toast } = useToast();

  // IdeWorkspace registers the hand-off so a quick question opens the AI panel.
  const registerAskHandler = useCallback((handler) => {
    askHandlerRef.current = handler;
  }, []);

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

  function handleQuickAsk(text) {
    const content = (text || "").trim();
    if (!content) return;
    if (!selectedProject || !askHandlerRef.current) {
      toast("Open a project first so ModCodes can use your code as context.", "info");
      return;
    }
    askHandlerRef.current(content);
  }

  function handleAttach() {
    toast("File attachments aren't available yet — ask ModCodes about files already in your project.", "info");
  }

  return (
<div className="workspace">
  {showOnboarding && (
    <Onboarding
      onComplete={(result) => {
        const provider = ONBOARDING_PROVIDER_MAP[result?.aiChoice];
        if (provider) {
          try {
            const saved = JSON.parse(localStorage.getItem("modcodes-settings") || "{}");
            saved.ai = { ...saved.ai, provider };
            localStorage.setItem("modcodes-settings", JSON.stringify(saved));
          } catch {}
        }
        setShowOnboarding(false);
      }}
      onSkip={() => setShowOnboarding(false)}
    />
  )}
  {selectedProject ? (
    <>
      <ProjectOpenAd />
      <IdeWorkspace selectedProject={selectedProject} registerAskHandler={registerAskHandler} />
    </>
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

  <ChatInput hasProject={Boolean(selectedProject)} onSubmit={handleQuickAsk} onAttach={handleAttach} />

  {isModalOpen && <CreateProjectModal closeModal={closeModal} addProject={addProject} />}
</div>
  );
}