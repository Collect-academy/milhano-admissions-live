"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function HelpTip({
  text,
  label = "Definition",
}: {
  text: string | null | undefined;
  label?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: "above" as "above" | "below" });

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const tooltipHeight = 110;
    const placement = rect.top > tooltipHeight + 18 ? "above" : "below";
    setPosition({
      left: Math.min(Math.max(rect.left + rect.width / 2, 170), window.innerWidth - 170),
      top: placement === "above" ? rect.top - 10 : rect.bottom + 10,
      placement,
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [updatePosition, visible]);

  if (!text) return null;

  const tooltip = mounted && visible ? createPortal(
    <span
      className={`help-tip-portal help-tip-portal-${position.placement}`}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
    >
      {text}
    </span>,
    document.body,
  ) : null;

  return (
    <>
      <span
        aria-label={`${label}: ${text}`}
        className="help-tip"
        onBlur={() => setVisible(false)}
        onFocus={() => { updatePosition(); setVisible(true); }}
        onMouseEnter={() => { updatePosition(); setVisible(true); }}
        onMouseLeave={() => setVisible(false)}
        ref={triggerRef}
        role="note"
        tabIndex={0}
      >
        ?
      </span>
      {tooltip}
    </>
  );
}
