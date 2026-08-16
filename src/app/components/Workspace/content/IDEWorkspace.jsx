export default function IdeWorkspace({ selectedProject }) {
    return (
      <section className="ide-workspace">
        <h1>MODCODES IDE</h1>
        <p>Project: {selectedProject?.name || "Untitled Project"}</p>
      </section>
    );
}