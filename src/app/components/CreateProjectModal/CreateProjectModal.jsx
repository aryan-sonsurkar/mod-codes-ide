import "./CreateProjectModal.css";

export default function CreateProjectModal() {
  return (
    <form>
    <h1>Create Project</h1>
    <label>Project Name:  </label><input placeholder="My Awesome Project"/>
    <label>Project Location:  </label><input placeholder="C://Desktop:/ModCodes"/>
    <label>Project Type:  </label>
    <select>
        <option>Blank Project</option>
        <option>Next.js</option>
        <option>React</option>
        <option>Node.js</option>
        <option>Python</option>
    </select>
    <input type="checkbox"></input><label>Initialize Git Repository</label>
    <button type="reset">Cancel</button>
    <button type="submit">Create</button>
    </form>
  );
}