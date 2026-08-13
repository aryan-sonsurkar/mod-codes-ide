export default function IdeWorkspace({ selectedProject }) {
    return (
      <section className="ide-workspace">
        <header className="ide-header">
          <h1>{selectedProject?.name || "Project"}</h1>
          <p>{selectedProject?.location || "No location selected"}</p>
        </header>

        <div className="ide-body">
          <p>Project type: {selectedProject?.type || "Unknown"}</p>
          <p>Git initialized: {selectedProject?.git ? "Yes" : "No"}</p>
        </div>
      </section>
    );
}