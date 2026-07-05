import "./CreateProjectModal.css";
import { useState } from "react";

export default function CreateProjectModal({closeModal,addProject}) {
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectGit, setProjectGit] = useState(false);
  function handleSubmit(event){
    const project = {
      name: projectName,
      location: projectLocation,
      type: projectType,
      git: projectGit
    };
    event.preventDefault();
    addProject(project);
    setProjectName("");
    setProjectGit(false);
    setProjectLocation("");
    setProjectType("");
  };
  return (
<div>  
    <div className="backdrop" onClick={closeModal}></div>
    <form className="ProjectModal" onSubmit={handleSubmit}>
    <h1>Create Project</h1>
    <label className="labels">Project Name:  </label><input className="input" placeholder="My Awesome Project" value={projectName} onChange={(event)=>{setProjectName(event.target.value);}}/>
    <label className="labels">Project Location:  </label><input className="input" placeholder="C://Desktop:/ModCodes" value={projectLocation} onChange={(event)=>{setProjectLocation(event.target.value);}}/>
    <label className="labels">Project Type:  </label>
    <select className="input" value={projectType} onChange={(event)=>{setProjectType(event.target.value);}}>
        <option>Blank Project</option>
        <option>Next.js</option>
        <option>React</option>
        <option>Node.js</option>
        <option>Python</option>
    </select>
    <section className="gitrepo">
    <input className="input" type="checkbox" checked={projectGit} onChange={(event)=>{setProjectGit(event.target.checked);}}></input><label className="labels">Initialize Git Repository</label></section>
    <section className="ModalButtons">
    <button className="button" type="reset" onClick={closeModal}>Cancel</button>
    <button className="button" type="submit">Create</button>
    </section>
    </form>
</div>  
  );
}