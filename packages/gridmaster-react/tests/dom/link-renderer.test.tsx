// Task 6A — A-082. LinkRenderer must only produce an <a> for an allowed scheme (built from the
// RAW value), with rel="noopener noreferrer" and target="_blank"; everything else is plain text.
// Language: TypeScript 6 (strict), React 19 + jsdom.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkRenderer } from "../../src/index";
import type { GridCellRendererProps } from "../../src/index";

type Row = { url: string };

function renderLink(value: unknown, formattedValue = String(value)) {
  const props = {
    row: { url: String(value) },
    rowIndex: 0,
    column: { key: "url", title: "URL", type: "link" },
    columnIndex: 0,
    value,
    formattedValue,
    isSelected: false,
    isActive: false,
    isEditing: false,
    mode: "editable",
    updateValue: () => {},
  } as unknown as GridCellRendererProps<Row>;
  return render(<LinkRenderer<Row> {...props} />);
}

describe("LinkRenderer scheme allow-list (A-082)", () => {
  const linked: Array<[string, string]> = [
    ["mailto:a@b.c", "mailto:a@b.c"],
    ["tel:+123", "tel:+123"],
    ["HTTP://x.y", "HTTP://x.y"],
    ["https://x.y/a?b=c#d", "https://x.y/a?b=c#d"],
    ["example.com", "https://example.com"],
  ];
  for (const [value, href] of linked) {
    it(`renders an anchor for ${value}`, () => {
      const { container } = renderLink(value);
      const a = container.querySelector("a");
      expect(a).not.toBeNull();
      expect(a?.getAttribute("href")).toBe(href);
      expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
      expect(a?.getAttribute("target")).toBe("_blank");
    });
  }

  const plain = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<b>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ];
  for (const value of plain) {
    it(`renders plain text (no anchor) for ${JSON.stringify(value)}`, () => {
      const { container } = renderLink(value);
      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).toBe(value);
    });
  }

  it("renders nothing for empty/whitespace", () => {
    expect(renderLink("", "").container.querySelector("a")).toBeNull();
    expect(renderLink("   ", "   ").container.querySelector("a")).toBeNull();
  });

  it("builds the href from the RAW value, not the formatted display text", () => {
    const { container } = renderLink("https://x.y/page", "x.y (click me)");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://x.y/page");
    expect(a?.textContent).toBe("x.y (click me)");
  });
});
