import "./ProjectItem.css";
export default function ProjectItem({ project, deleteProject, openProject }) {
  return (
<div className="project-item">
    <h2>{project.name}</h2>
    <p>{project.type}</p>
    <button className="open-button" onClick={() => openProject(project.id)}>Open</button>
    <button className="delete-button" onClick={() => deleteProject(project.id)}>Delete</button>
</div> 
  );
}