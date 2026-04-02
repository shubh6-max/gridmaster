import { useEffect, useState } from "react";
import { safeDomRect } from "../../core/utils";

export function useFloatingPortal(id = "gm-floating-root"): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let element = document.getElementById(id);
    let created = false;

    if (!element) {
      element = document.createElement("div");
      element.id = id;
      document.body.appendChild(element);
      created = true;
    }

    setTarget(element);

    return () => {
      if (created && element?.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, [id]);

  return target;
}

export function useFloatingAnchorRect(
  anchorEl?: HTMLElement | null,
  anchorRect?: DOMRect | null,
  onAnchorInvalid?: () => void
): DOMRect {
  const [rect, setRect] = useState<DOMRect>(() =>
    anchorEl?.isConnected ? anchorEl.getBoundingClientRect() : safeDomRect(anchorRect)
  );

  useEffect(() => {
    const updateRect = () => {
      if (anchorEl) {
        if (!anchorEl.isConnected) {
          onAnchorInvalid?.();
          return;
        }

        setRect(anchorEl.getBoundingClientRect());
        return;
      }

      setRect(safeDomRect(anchorRect));
    };

    updateRect();

    if (typeof window === "undefined") return;

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    let resizeObserver: ResizeObserver | null = null;

    if (anchorEl && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(anchorEl);
    }

    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      resizeObserver?.disconnect();
    };
  }, [anchorEl, anchorRect, onAnchorInvalid]);

  return rect;
}
