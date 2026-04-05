import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import {
  credentialPayloadSchema,
  type CredentialPayload
} from "@bridgey/contracts";

export class CredentialVault {
  private readonly masterKey: Buffer;

  public constructor(masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error("BRIDGEY_MASTER_KEY must decode to exactly 32 bytes");
    }

    this.masterKey = masterKey;
  }

  public static fromBase64(encodedKey: string): CredentialVault {
    return new CredentialVault(Buffer.from(encodedKey, "base64"));
  }

  public encrypt(payload: CredentialPayload): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
  }

  public decrypt(encryptedPayload: string): CredentialPayload {
    const input = Buffer.from(encryptedPayload, "base64");
    const iv = input.subarray(0, 12);
    const tag = input.subarray(12, 28);
    const ciphertext = input.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.masterKey, iv);

    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString("utf8");

    return credentialPayloadSchema.parse(JSON.parse(plaintext));
  }
}

