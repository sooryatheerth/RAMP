import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);
let _idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 4000) => {
    const id = ++_idCounter;
    setToasts((ts) => [...ts, { id, message, type }]);
    setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error", 6000),
    warn: (msg) => addToast(msg, "warn"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        pointerEvents: "none",
      }}
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            pointerEvents: "all",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
            minWidth: 240,
            maxWidth: 360,
            animation: "toast-in 0.2s ease",
            background:
              t.type === "error"
                ? "var(--color-danger)"
                : t.type === "warn"
                ? "var(--color-warn)"
                : "var(--color-primary)",
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            aria-label="Dismiss notification"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              opacity: 0.8,
              fontSize: "1rem",
              cursor: "pointer",
              padding: "0 0.2rem",
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
