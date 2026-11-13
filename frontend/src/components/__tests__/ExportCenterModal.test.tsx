import { describe, expect, it } from "vitest";
import componentSource from "../ExportCenterModal.tsx?raw";

describe("ExportCenterModal failed export handling", () => {
  it("does not bind the failure message to preview content", () => {
    expect(componentSource).not.toContain(
      'setPreviewContent("Failed to generate export. Please ensure engine is running.")',
    );
  });

  it("tracks generation failure separately from artifact state", () => {
    expect(componentSource).toContain("previewError");
    expect(componentSource).toContain(
      'setPreviewError("Failed to generate export. Please ensure engine is running.")',
    );
  });

  it("renders an explicit error state instead of artifact controls", () => {
    expect(componentSource).toContain('role="alert"');
  });
});
