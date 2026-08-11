import "./ProjectItem.css";
export default function ProjectItem({ project, deleteProject }) {
  return (
<div className="project-item">
    <h2>{project.name}</h2>
    <p>{project.type}</p>
    <button className="delete-button" onClick={() => deleteProject(project.id)}>Delete</button>
</div> 
  );
}