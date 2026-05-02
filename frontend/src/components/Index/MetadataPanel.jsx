export default function MetadataPanel({
  title,
  author,
  onTitleChange,
  onAuthorChange,
  onContinue
}) {
  return (
    <div id="metadata-panel" className="metadata-panel">
      <div className="metadata-card">
        <h2>Reading Details</h2>
        <div className="metadata-fields">
          <label htmlFor="title-input">Title</label>
          <input
            id="title-input"
            type="text"
            placeholder="Enter title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <label htmlFor="author-input">Author</label>
          <input
            id="author-input"
            type="text"
            placeholder="Enter author"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
          />
        </div>
        <div className="actions">
          <button
            id="metadata-continue-btn"
            className="btn"
            type="button"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
