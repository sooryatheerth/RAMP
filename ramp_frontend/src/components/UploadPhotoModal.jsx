import { useState } from "react";
import { ImagesAPI } from "../api/client";

export default function UploadPhotoModal({ entityType, entityId, title, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      setError("File exceeds maximum allowed size (5 MB).");
      return;
    }
    setError("");
    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(selected);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { setError("Please select an image file."); return; }
    if (!altText.trim()) { setError("Alt text is required for screen-reader and WCAG accessibility."); return; }

    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("entity_type", entityType);
      formData.append("entity_id", entityId);
      formData.append("alt_text", altText);
      if (caption.trim()) formData.append("caption", caption);

      await ImagesAPI.upload(formData);
      onUploaded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || "Could not upload photo. Please check the image limit or size.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-photo-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1050,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#ffffff",
          borderRadius: 14,
          padding: "1.5rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 id="upload-photo-title" style={{ margin: 0 }}>
            {title || "Upload Accessibility Photo"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "var(--color-text-muted)" }}
          >
            ✕
          </button>
        </div>

        {error && <p className="error-text" role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="photo-file">Select Image (Max 5 MB)</label>
            <input
              id="photo-file"
              type="file"
              accept="image/*"
              required
              onChange={handleFileChange}
            />
          </div>

          {preview && (
            <div style={{ marginBottom: "1rem", textAlign: "center" }}>
              <img
                src={preview}
                alt="Preview"
                style={{ maxHeight: 150, maxWidth: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-border)" }}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="photo-alt">
              Accessibility Description (Alt Text) <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <input
              id="photo-alt"
              required
              placeholder="e.g. Concrete entrance ramp with handrails and 1:12 slope"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Required for visually impaired visitors using screen readers.
            </span>
          </div>

          <div className="field">
            <label htmlFor="photo-caption">Caption (Optional)</label>
            <input
              id="photo-caption"
              placeholder="e.g. Main street entrance ramp"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "1.25rem" }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Uploading…" : "Upload Photo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
