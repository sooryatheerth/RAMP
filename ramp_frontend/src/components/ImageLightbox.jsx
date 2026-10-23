import { useEffect } from "react";
import { ImagesAPI } from "../api/client";

export default function ImageLightbox({ images, currentIndex, onClose, onNavigate }) {
  const current = images[currentIndex];

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onNavigate && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      }
      if (e.key === "ArrowRight" && onNavigate && currentIndex < images.length - 1) {
        onNavigate(currentIndex + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(10, 15, 25, 0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "#ffffff",
          marginBottom: "0.75rem",
          padding: "0 0.5rem",
        }}
      >
        <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          {currentIndex + 1} of {images.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Close image viewer"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            border: "none",
            color: "#ffffff",
            fontSize: "1.4rem",
            width: 38,
            height: 38,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          ✕
        </button>
      </div>

      {/* Main Image Display */}
      <div
        style={{
          position: "relative",
          maxWidth: 960,
          maxHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Previous Button */}
        {images.length > 1 && (
          <button
            onClick={() => onNavigate && onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1)}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: -50,
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              fontSize: "1.5rem",
              width: 44,
              height: 44,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ‹
          </button>
        )}

        <img
          src={ImagesAPI.fileUrl(current.id)}
          alt={current.alt_text || "Place accessibility view"}
          style={{
            maxWidth: "100%",
            maxHeight: "70vh",
            objectFit: "contain",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        />

        {/* Next Button */}
        {images.length > 1 && (
          <button
            onClick={() => onNavigate && onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0)}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: -50,
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              fontSize: "1.5rem",
              width: 44,
              height: 44,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ›
          </button>
        )}
      </div>

      {/* Caption & Metadata Footer */}
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          textAlign: "center",
          color: "#ffffff",
          marginTop: "1rem",
          background: "rgba(0, 0, 0, 0.4)",
          padding: "0.8rem 1.2rem",
          borderRadius: 10,
        }}
      >
        {current.caption && (
          <p style={{ margin: "0 0 0.3rem", fontWeight: 600, fontSize: "1rem" }}>
            {current.caption}
          </p>
        )}
        <p style={{ margin: 0, fontSize: "0.88rem", color: "#cbd5e1" }}>
          <strong>Accessibility Description (Alt):</strong> {current.alt_text}
        </p>
      </div>
    </div>
  );
}
