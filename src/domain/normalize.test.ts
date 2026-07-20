import { describe, expect, it } from "vitest";
import {
  normalizeCampaignName,
  normalizeScript,
  normalizeTerritory,
  normalizeTopicTag,
} from "./normalize";

describe("normalizeScript", () => {
  it("unifies CRLF and CR newlines to LF", () => {
    expect(normalizeScript("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("strips trailing spaces, tabs and no-break spaces per line", () => {
    expect(normalizeScript("line one   \nline two\t\nline three ")).toBe(
      "line one\nline two\nline three",
    );
  });

  it("trims the whole script", () => {
    expect(normalizeScript("\n\n  hello  \n\n")).toBe("hello");
  });

  it("applies Unicode NFC so canonically equivalent text is identical", () => {
    const composed = "café"; // é as a single codepoint
    const decomposed = "café"; // e + combining acute
    expect(normalizeScript(decomposed)).toBe(normalizeScript(composed));
  });

  it("preserves interior spacing and casing (the spoken text)", () => {
    expect(normalizeScript("Hello  WORLD")).toBe("Hello  WORLD");
  });
});

describe("value normalization", () => {
  it("territories compare uppercase", () => {
    expect(normalizeTerritory(" ae ")).toBe("AE");
  });

  it("topic tags compare lowercase with collapsed whitespace", () => {
    expect(normalizeTopicTag("  Political   News ")).toBe("political news");
  });

  it("campaign names compare case-insensitively", () => {
    expect(normalizeCampaignName("MITHAQ  Demo Campaign")).toBe(
      normalizeCampaignName("mithaq demo campaign"),
    );
  });
});
