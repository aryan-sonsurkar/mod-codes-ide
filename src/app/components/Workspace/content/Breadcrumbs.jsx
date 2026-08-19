import "./Breadcrumbs.css";

export default function Breadcrumbs({ path, onNavigateDirectory }) {
  if (!path) {
    return null;
  }

  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav className="breadcrumbs" aria-label="Current file location">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const dirPath = segments.slice(0, index + 1).join("/");

        return (
          <span className="breadcrumb-part" key={dirPath}>
            {index > 0 && (
              <span className="breadcrumb-separator" aria-hidden="true">
                /
              </span>
            )}
            {isLast ? (
              <span className="breadcrumb-segment breadcrumb-current">
                {segment}
              </span>
            ) : (
              <button
                className="breadcrumb-segment breadcrumb-link"
                title={`Reveal ${dirPath}`}
                onClick={() => onNavigateDirectory?.(dirPath)}
              >
                {segment}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}