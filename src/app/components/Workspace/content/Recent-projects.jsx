import "./Recent-projects.css";
import ProjectItem from "./ProjectItem";
export default function Recentprojects({projects,deleteProject}) {
  if (projects.length === 0){
    return(
    <div>
      <h3>Recent Projects</h3>
      <ul>
        <p>No recent projects.</p>
      </ul>
    </div>
    );
  }
  return (
<div>
<h3>Recent Projects</h3>
      <ul>
        {projects.map((project) => {
          return (
            <ProjectItem key={project.id} project={project} deleteProject={deleteProject}/>
          );
        })}
      </ul>
</div>
  );
}