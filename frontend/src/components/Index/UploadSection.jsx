import { useRef } from 'react';

export default function UploadSection({
  uploadMode,
  onModeChange,
  onFileSelect,
  onTextChange,
  status,
  statusKind,
  selectedFile,
  textValue,
  onContinue,
  isContinueDisabled
}) {
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    if (uploadMode === "file") {
      onFileSelect(e.dataTransfer?.files?.[0]);
    }
  };

  const handleFileChange = (e) => {
    onFileSelect(e.target.files?.[0]);
  };

  return (
    <section className="card" id="upload-section">
      <div className="window-titlebar">
        <span className="window-title">TomoTube</span>
        <span className="window-icon" aria-hidden="true"></span>
      </div>

      <div className="upload-stage">
        <div className="upload-card">
          <h1>Upload a Reading</h1>
          <div className="upload-tabs" role="tablist" aria-label="Upload options">
            <button
              id="upload-tab-file"
              className={`btn upload-tab ${uploadMode === "file" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={uploadMode === "file"}
              onClick={() => {
                onModeChange("file");
                fileInputRef.current?.click();
              }}
            >
              File
            </button>
            <button
              id="upload-tab-text"
              className={`btn upload-tab ${uploadMode === "text" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={uploadMode === "text"}
              onClick={() => onModeChange("text")}
            >
              Text
            </button>
          </div>

          {uploadMode === "file" && (
            <>
              <div
                className="drop-zone"
                tabIndex="0"
                role="button"
                aria-label="PDF upload area"
                onClick={handleDropZoneClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <p id="drop-zone-primary">
                  {selectedFile ? selectedFile.name : "Drag and drop a PDF here"}
                </p>
                <p id="drop-zone-secondary">
                  {selectedFile ? "" : "or click File to choose one"}
                </p>
                <input
                  ref={fileInputRef}
                  id="pdf-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
            </>
          )}

          {uploadMode === "text" && (
            <div className="text-input-wrap">
              <textarea
                ref={textInputRef}
                id="manual-text-input"
                className="manual-text-input"
                placeholder="Enter your text here"
                aria-label="Text input area"
                value={textValue}
                onChange={(e) => onTextChange(e.target.value)}
              ></textarea>
            </div>
          )}

          <div className="actions upload-continue">
            <button
              id="continue-btn"
              className="btn"
              type="button"
              disabled={isContinueDisabled}
              onClick={onContinue}
            >
              Continue
            </button>
          </div>
          <p id="status" className={`status ${statusKind}`.trim()} aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
