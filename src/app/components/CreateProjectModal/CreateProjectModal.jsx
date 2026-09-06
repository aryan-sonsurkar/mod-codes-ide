import "./CreateProjectModal.css";
import { useState } from "react";

export default function CreateProjectModal({ closeModal, addProject }) {
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [bringing, setBringing] = useState("idea");
  const [projectType, setProjectType] = useState("Blank Project");
  const [projectGit, setProjectGit] = useState(false);
  const [githubRepo, setGithubRepo] = useState(false);

  async function chooseProjectFolder() {
    if (!("showDirectoryPicker" in window)) {
      window.alert("Folder selection is not supported in this browser. Please use a Chromium-based browser.");
      return;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker();
      setProjectLocation(directoryHandle.name);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Failed to pick directory:", error);
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!projectName.trim() || !projectLocation.trim()) {
      window.alert("Please provide project name and folder.");
      return;
    }
    const currentTime = Date.now();
    const project = {
      id: crypto.randomUUID(),
      name: projectName.trim(),
      location: projectLocation,
      type: projectType,
      bringing, // idea | codebase | hybrid | empty
      git: projectGit,
      githubRepo,
      createdAt: currentTime,
      lastOpened: currentTime,
      favorite: false,
    };
    addProject(project);
    setProjectName("");
    setProjectGit(false);
    setGithubRepo(false);
    setProjectLocation("");
    setProjectType("Blank Project");
    setBringing("idea");
  }

  return (
    <div>
      <div className="backdrop" onClick={closeModal} aria-hidden="true"></div>
      <form className="ProjectModal" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label="Create new project">
        <h1>Create Project</h1>

        <label className="labels" htmlFor="project-name">Project Name</label>
        <input
          id="project-name"
          className="input"
          placeholder="My Awesome Project"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          required
        />

        <label className="labels" htmlFor="project-location">Project Location</label>
        <div className="location-picker">
          <input
            id="project-location"
            className="input"
            placeholder="Select a folder"
            value={projectLocation}
            readOnly
            aria-describedby="location-hint"
          />
          <button type="button" className="button" onClick={chooseProjectFolder} aria-label="Browse for project folder">
            Browse
          </button>
        </div>
        <p id="location-hint" style={{color:"var(--muted-text)",fontSize:11,margin:"2px 0 0"}}>
          Your browser will ask for folder access. Files stay on your machine.
        </p>

        <label className="labels" htmlFor="project-bringing">What are you bringing?</label>
        <select
          id="project-bringing"
          className="input"
          value={bringing}
          onChange={(event) => setBringing(event.target.value)}
        >
          <option value="idea">Idea — I have an idea for a project</option>
          <option value="codebase">Existing Codebase — I have code already</option>
          <option value="hybrid">Hybrid — Idea + existing code</option>
          <option value="empty">Empty — Start from scratch</option>
        </select>

        <label className="labels" htmlFor="project-type">Project Type</label>
        <select
          id="project-type"
          className="input"
          value={projectType}
          onChange={(event) => setProjectType(event.target.value)}
        >
          <option>Blank Project</option>
          <option>Next.js</option>
          <option>React</option>
          <option>Node.js</option>
          <option>Python</option>
        </select>

        <section className="gitrepo">
          <input
            id="project-git"
            className="input"
            type="checkbox"
            checked={projectGit}
            onChange={(event) => setProjectGit(event.target.checked)}
          />
          <label className="labels" htmlFor="project-git">Initialize Git Repository</label>
        </section>
        <section className="gitrepo">
          <input
            id="project-github"
            className="input"
            type="checkbox"
            checked={githubRepo}
            onChange={(event) => setGithubRepo(event.target.checked)}
          />
          <label className="labels" htmlFor="project-github">Create GitHub Repository (offered at creation)</label>
        </section>
        <p style={{ color: "var(--secondary-text)", fontSize: "12px", margin: "4px 0 0" }}>
          {bringing === "idea" && "Flow: idea → research → PRD → roadmap → development. You can start coding earlier."}
          {bringing === "codebase" && "MODCODES will inspect the codebase first, then propose a plan for approval."}
          {bringing === "hybrid" && "Understand existing code + idea → research → gap analysis → architecture → plan → approve → execute."}
          {bringing === "empty" && "Start with a clean workspace and .modcodes memory."}
        </p>

        <section className="ModalButtons">
          <button className="button" type="reset" onClick={closeModal}>Cancel</button>
          <button className="button" type="submit">Create</button>
        </section>
      </form>
    </div>
  );
}