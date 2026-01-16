import { describe, expect, it } from "vitest";
import { rewriteEngine } from "./rewriteEngine";
import type { RewriteOptions } from "./types";

const baseOptions: RewriteOptions = {
  activeVoice: true,
  clearOwnership: true,
  sharperImpact: true,
  calmTone: true,
  concise: true,

  auditSafeMode: true,

  owner: "Operations",
  documentType: "audit-finding",

  englishVariant: "en-GB",
  standardiseSpelling: true,
};

describe("RewriteEngine - audit safety", () => {
  it("preserves qualifiers in audit-safe mode", () => {
    const input = "Access reviews may not detect unauthorised access promptly.";
    const out = rewriteEngine.rewrite(input, baseOptions, []).rewrittenText.toLowerCase();
    expect(out).toContain("may");
  });

  it("does not invent negation", () => {
    const input = "Access reviews were completed quarterly.";
    const out = rewriteEngine.rewrite(input, baseOptions, []).rewrittenText.toLowerCase();
    expect(out).toContain("completed");
    expect(out).not.toContain("did not");
  });

  it("converts passive->active safely when explicitly negative and owner provided", () => {
    const input = "Access reviews were not completed quarterly.";
    const out = rewriteEngine.rewrite(input, baseOptions, []).rewrittenText.toLowerCase();
    expect(out).toContain("did not complete");
    expect(out).toContain("operations");
  });

  it("does not auto-insert impact claims (suggestion only)", () => {
    const input = "The onboarding process is inconsistently followed.";
    const res = rewriteEngine.rewrite(input, baseOptions, []);
    expect(res.rewrittenText.toLowerCase()).not.toContain("increases operational risk");
  });

  it("standardises UK->US when englishVariant is en-US", () => {
    const input = "Unauthorised access was detected.";
    const res = rewriteEngine.rewrite(input, { ...baseOptions, englishVariant: "en-US" }, []);
    expect(res.rewrittenText.toLowerCase()).toContain("unauthorized");
  });

  it("does not modify protected tokens (email/url/path/backticks)", () => {
    const input =
      "Email ops@company.com regarding unauthorised access. See https://example.com/authorisation. Path C:\\Temp\\authorisation\\file.txt. Use `authorisation` as the config key.";
    const res = rewriteEngine.rewrite(input, { ...baseOptions, englishVariant: "en-US" }, []);
    expect(res.rewrittenText).toContain("ops@company.com");
    expect(res.rewrittenText).toContain("https://example.com/authorisation");
    expect(res.rewrittenText).toContain("C:\\Temp\\authorisation\\file.txt");
    expect(res.rewrittenText).toContain("`authorisation`");
  });

  it("capitalises first letter and ensures terminal punctuation", () => {
    const input = "this is a test sentence";
    const res = rewriteEngine.rewrite(input, baseOptions, []);
    expect(res.rewrittenText[0]).toBe("T");
    expect(res.rewrittenText.trim().endsWith(".")).toBe(true);
  });

  it("detects mixed UK/US spelling and suggests consistency", () => {
    const input = "Unauthorised access was detected and we will analyze logs.";
    const res = rewriteEngine.rewrite(input, baseOptions, []);
    expect(res.suggestions.join(" ").toLowerCase()).toContain("mixed uk/us");
  });
});
