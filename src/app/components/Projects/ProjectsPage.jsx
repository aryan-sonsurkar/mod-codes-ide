"use client";
import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import ConfirmDialog from "../Dialogs/ConfirmDialog";
import "./ProjectsPage.css";

function formatLastOpened(timestamp) {
  if (!timestamp) {
    return "Never opened";
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

const SORT_OPTIONS = [
  { value: "recently-opened", label: "Recently opened" },
  { value: "recently-created", label: "Recently created" },
  { value: "name", label: "Name" },
];

export default function ProjectsPage({
  projects,
  onOpen,
  onDelete,
  onCreate,
  onToggleFavorite,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recently-opened");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const { settings } = useSettings();

  const trimmed = query.trim().toLowerCase();

  const filtered = projects.filter((project) => {
    if (favoritesOnly && !project.favorite) {
      return false;
    }
    if (!trimmed) {
      return true;
    }
    return (
      (project.name || "").toLowerCase().includes(trimmed) ||
      (project.type || "").toLowerCase().includes(trimmed) ||
      (project.location || "").toLowerCase().includes(trimmed)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (sort === "recently-created") {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    return (b.lastOpened || 0) - (a.lastOpened || 0);
  });

  const confirmProject = projects.find((project) => project.id === confirmId) || null;

  return (
    <section className="projects-page">
      <div className="projects-header">
        <h2 className="projects-title">Projects</h2>
        <button className="projects-new-button" onClick={onCreate}>
          + New Project
        </button>
      </div>

      <div className="projects-toolbar">
        <input
          className="projects-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects..."
        />
        <label className="projects-sort">
          <span className="projects-sort-label">Sort</span>
          <select
            className="projects-sort-select"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="projects-favorites">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(event) => setFavoritesOnly(event.target.checked)}
          />
          Favorites only
        </label>
      </div>

      {projects.length === 0 ? (
        <div className="projects-empty">
          <p className="projects-empty-title">No projects yet</p>
          <p className="projects-empty-text">
            Create your first project to start building in the browser.
          </p>
          <button className="projects-new-button" onClick={onCreate}>
            Create a project
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="projects-empty">
          <p className="projects-empty-title">No matching projects</p>
          <p className="projects-empty-text">
            Try a different search or clear the filters.
          </p>
        </div>
      ) : (
        <div className="projects-list">
          {sorted.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-main">
                <button
                  className="project-favorite"
                  title={project.favorite ? "Remove favorite" : "Add favorite"}
                  onClick={() => onToggleFavorite(project.id)}
                >
                  {project.favorite ? "★" : "☆"}
                </button>
                <div className="project-card-info">
                  <h3 className="project-card-name">{project.name}</h3>
                  <p className="project-card-meta">
                    {project.type || "Untyped"} ·{" "}
                    {project.location || "No folder selected"}
                  </p>
                  <p className="project-card-meta">
                    Last opened {formatLastOpened(project.lastOpened)}
                  </p>
                </div>
              </div>
              <div className="project-card-actions">
                <button
                  className="projects-open-button"
                  onClick={() => onOpen(project.id)}
                >
                  Open
                </button>
                <button
                  className="projects-delete-button"
                  onClick={() => {
                    if (settings.projects.confirmBeforeDelete) {
                      setConfirmId(project.id);
                    } else {
                      onDelete(project.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmProject)}
        title="Delete project"
        message={
          <>
            Delete <strong>{confirmProject?.name}</strong>? This cannot be
            undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirmProject) {
            onDelete(confirmProject.id);
          }
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </section>
  );
}