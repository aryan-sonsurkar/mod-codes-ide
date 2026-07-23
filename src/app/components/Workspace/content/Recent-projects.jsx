import "./Recent-projects.css";

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
        {projects.map((project,index) => {
          return (
            <li className="project-item" key={index}>
            {project.name} -  {project.type}
            <button className="delete-button" onClick={()=>deleteProject(project)} >Delete</button>
            </li>
          );
        })}
      </ul>
</div>
  );
}