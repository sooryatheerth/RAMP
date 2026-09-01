/**
 * The signature recurring element of the app: a badge that always shows
 * confidence as color + icon + text together, never color alone, since
 * this is the one piece of UI a screen-reader user and a low-vision user
 * both need to interpret unambiguously.
 */
export default function ConfidenceBadge({ score }) {
  const value = Number(score) || 0;
  let tier = "low";
  let label = "Low confidence";
  if (value >= 75) {
    tier = "high";
    label = "Verified accessible";
  } else if (value >= 40) {
    tier = "medium";
    label = "Partially verified";
  } else {
    label = "Needs verification";
  }

  return (
    <span className={`confidence-badge ${tier}`}>
      <span className="dot" aria-hidden="true" />
      {label} · {value}%
    </span>
  );
}
