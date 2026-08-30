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
      <div className="backdrop" onClick={closeModal}></div>
      <form className="ProjectModal" onSubmit={handleSubmit}>
        <h1>Create Project</h1>

        <label className="labels">Project Name: </label>
        <input
          className="input"
          placeholder="My Awesome Project"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
        />

        <label className="labels">Project Location: </label>
        <div className="location-picker">
          <input
            className="input"
            placeholder="Select a folder"
            value={projectLocation}
            readOnly
          />
          <button type="button" className="button" onClick={chooseProjectFolder}>
            Browse
          </button>
        </div>

        <label className="labels">What are you bringing?</label>
        <select
          className="input"
          value={bringing}
          onChange={(event) => setBringing(event.target.value)}
        >
          <option value="idea">IDEA — I have an idea</option>
          <option value="codebase">EXISTING CODEBASE</option>
          <option value="hybrid">IDEA + EXISTING CODEBASE (hybrid)</option>
          <option value="empty">EMPTY PROJECT</option>
        </select>

        <label className="labels">Project Type: </label>
        <select
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
            className="input"
            type="checkbox"
            checked={projectGit}
            onChange={(event) => setProjectGit(event.target.checked)}
          ></input>
          <label className="labels">Initialize Git Repository</label>
        </section>
        <section className="gitrepo">
          <input
            className="input"
            type="checkbox"
            checked={githubRepo}
            onChange={(event) => setGithubRepo(event.target.checked)}
          ></input>
          <label className="labels">Create GitHub Repository (offered at creation)</label>
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