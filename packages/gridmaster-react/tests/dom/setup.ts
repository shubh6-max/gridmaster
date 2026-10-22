// jsdom polyfills for browser APIs the grid uses but jsdom does not implement.
// Test-only: nothing here ships in the package. Language: TypeScript 6 (strict).
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount rendered trees between tests (vitest globals are off, so RTL cannot auto-register this).
afterEach(() => cleanup());

// jsdom lacks Element.scrollTo / scrollIntoView; scroll position is tracked via scrollTop/scrollLeft.
if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = function scrollTo(
    this: Element,
    optionsOrX?: ScrollToOptions | number,
    y?: number
  ): void {
    if (typeof optionsOrX === "object" && optionsOrX !== null) {
      if (optionsOrX.left !== undefined) this.scrollLeft = optionsOrX.left;
      if (optionsOrX.top !== undefined) this.scrollTop = optionsOrX.top;
    } else {
      if (optionsOrX !== undefined) this.scrollLeft = optionsOrX;
      if (y !== undefined) this.scrollTop = y;
    }
  } as Element["scrollTo"];
}

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

// jsdom (v29) ships `PointerEvent` but NOT Element.setPointerCapture/releasePointerCapture, which the
// pointer-drag handlers (selection, resize, fill) call. No-op stand-ins keep the capture calls from
// throwing; production code still guards them for older browsers / SSR.
if (typeof Element.prototype.setPointerCapture !== "function") {
  Element.prototype.setPointerCapture = function setPointerCapture(): void {};
}
if (typeof Element.prototype.releasePointerCapture !== "function") {
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {};
}

// jsdom has no ResizeObserver; a no-op stand-in is enough for layout-agnostic behaviour tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
