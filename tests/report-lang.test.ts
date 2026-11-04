// @agent:   claude-code
// @project: hanbridge-inspector
// @purpose: /r/:id opens in English by default; only ?lang=ru gives Russian
// @created: 2026-11-04
import { describe, expect, it } from "vitest";
import { reportLang } from "@/app/r/[id]/lang";

describe("reportLang", () => {
  it("defaults to English", () => { expect(reportLang(undefined)).toBe("en"); });
  it("keeps Russian only for ?lang=ru", () => { expect(reportLang("ru")).toBe("ru"); expect(reportLang("en")).toBe("en"); });
  it("odd values fall back to English", () => { expect(reportLang("RU")).toBe("en"); expect(reportLang(["ru", "en"])).toBe("en"); expect(reportLang("")).toBe("en"); });
});
