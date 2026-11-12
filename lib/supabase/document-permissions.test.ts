
import { describe, expect, it } from "vitest";
import { canEditDocument } from "./document-permissions";

describe("canEditDocument", () => {
  it("allows owners to edit", () => {
    expect(canEditDocument("owner")).toBe(true);
  });

  it("allows editors to edit", () => {
    expect(canEditDocument("editor")).toBe(true);
  });

  it("prevents viewers from editing", () => {
    expect(canEditDocument("viewer")).toBe(false);
  });
});
