import { describe, expect, it } from "vitest";

import { CredentialVault } from "@bridgey/browser-worker";

describe("credential vault", () => {
  it("encrypts and decrypts credential payloads", () => {
    const vault = CredentialVault.fromBase64(Buffer.alloc(32, 7).toString("base64"));
    const encrypted = vault.encrypt({
      username: "bridgey",
      password: "secret",
      extras: {
        otp_seed: "12345"
      }
    });

    expect(encrypted).not.toContain("bridgey");
    expect(vault.decrypt(encrypted)).toEqual({
      username: "bridgey",
      password: "secret",
      extras: {
        otp_seed: "12345"
      }
    });
  });
});

