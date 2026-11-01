import { afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { generatedFileForUrl, generatedIsServed, generatedRoot } from "./generated";

afterEach(() => vi.unstubAllEnvs());

describe("generated files location", () => {
  it("locally: public/generated, served", () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("GENERATED_TMP", "");
    expect(generatedIsServed()).toBe(true);
    expect(generatedRoot()).toBe(path.join(process.cwd(), "public", "generated"));
  });
  it("on Vercel: /tmp, not served (the deployment FS is read-only)", () => {
    vi.stubEnv("VERCEL", "1");
    expect(generatedIsServed()).toBe(false);
    expect(generatedRoot().startsWith(tmpdir())).toBe(true);
    expect(generatedFileForUrl("/generated/kia-morning/a-listing.jpg")).toBe(path.join(generatedRoot(), "kia-morning", "a-listing.jpg"));
  });
  it("rejects traversal and foreign urls", () => {
    expect(generatedFileForUrl("/generated/../../etc/passwd")).toBeNull();
    expect(generatedFileForUrl("/other/x.jpg")).toBeNull();
    expect(generatedFileForUrl("https://x/generated/a.jpg")).toBeNull();
  });
});
