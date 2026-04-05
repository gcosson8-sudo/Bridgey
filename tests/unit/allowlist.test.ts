import { describe, expect, it } from "vitest";

import {
  assertUrlAllowed,
  hostnameMatchesDomain,
  isUrlAllowed,
  normalizeDomain
} from "@bridgey/browser-worker";

describe("allowlist helpers", () => {
  it("normalizes configured domains", () => {
    expect(normalizeDomain("*.Example.COM.")).toBe("example.com");
  });

  it("matches exact hostnames and subdomains", () => {
    expect(hostnameMatchesDomain("docs.example.com", "example.com")).toBe(true);
    expect(hostnameMatchesDomain("evil-example.com", "example.com")).toBe(false);
  });

  it("allows http and https URLs on allowlisted domains", () => {
    expect(isUrlAllowed("https://example.com/page", ["example.com"])).toBe(true);
    expect(isUrlAllowed("http://docs.example.com", ["example.com"])).toBe(true);
    expect(isUrlAllowed("file:///tmp/test.html", ["example.com"])).toBe(false);
  });

  it("throws a structured error for blocked domains", () => {
    expect(() => assertUrlAllowed("https://blocked.test", ["example.com"])).toThrowError(
      /allowlisted/
    );
  });
});

