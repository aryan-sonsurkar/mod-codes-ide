import "./Quick-actions.css";

export default function Quickactions({openModal}) {
  return (
<div className="quick-actions">
      <h3>Quick Actions</h3>
      <div className="action-buttons">
      <button className="action-button" onClick={openModal}>Create New Project</button>
      <button className="action-button">Open Existing Project</button>
      </div>
</div>
  );
}