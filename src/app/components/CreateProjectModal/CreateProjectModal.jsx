import "./CreateProjectModal.css";

export default function CreateProjectModal({closeModal}) {
  return (
<div>  
    <div className="backdrop" closeModal={closeModal} onClick={closeModal}></div>
    <form className="ProjectModal">
    <h1>Create Project</h1>
    <label className="labels">Project Name:  </label><input className="input" placeholder="My Awesome Project"/>
    <label className="labels">Project Location:  </label><input className="input" placeholder="C://Desktop:/ModCodes"/>
    <label className="labels">Project Type:  </label>
    <select className="input">
        <option>Blank Project</option>
        <option>Next.js</option>
        <option>React</option>
        <option>Node.js</option>
        <option>Python</option>
    </select>
    <section className="gitrepo">
    <input className="input" type="checkbox"></input><label className="labels">Initialize Git Repository</label></section>
    <section className="ModalButtons">
    <button className="button" type="reset" onClick={closeModal}>Cancel</button>
    <button className="button" type="submit">Create</button>
    </section>
    </form>
</div>  
  );
}