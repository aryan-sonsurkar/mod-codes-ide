import "./CreateProjectModal.css";
import { useState } from "react";

export default function CreateProjectModal({ closeModal, addProject }) {
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectGit, setProjectGit] = useState(false);

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
    const currentTime = Date.now();
    const project = {
      id: crypto.randomUUID(),
      name: projectName,
      location: projectLocation,
      type: projectType,
      git: projectGit,
      createdAt: currentTime,
      lastOpened: currentTime,
      favorite: false,
    };
    event.preventDefault();
    addProject(project);
    setProjectName("");
    setProjectGit(false);
    setProjectLocation("");
    setProjectType("");
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

        <section className="ModalButtons">
          <button className="button" type="reset" onClick={closeModal}>Cancel</button>
          <button className="button" type="submit">Create</button>
        </section>
      </form>
    </div>
  );
}