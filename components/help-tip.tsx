export function HelpTip({
  text,
  label = "Definition",
}: {
  text: string | null | undefined;
  label?: string;
}) {
  if (!text) return null;

  return (
    <span
      aria-label={`${label}: ${text}`}
      className="help-tip"
      data-tooltip={text}
      role="note"
      tabIndex={0}
    >
      ?
    </span>
  );
}
