import { describe, expect, it } from "vitest";

import {
  actionSchema,
  runActionsRequestSchema,
  typeActionSchema
} from "@bridgey/contracts";

describe("shared contracts", () => {
  it("accepts credential-backed type actions", () => {
    expect(
      typeActionSchema.parse({
        type: "type",
        selector: "#password",
        credentialField: "password"
      })
    ).toMatchObject({
      type: "type",
      credentialField: "password"
    });
  });

  it("rejects ambiguous type actions", () => {
    expect(() =>
      actionSchema.parse({
        type: "type",
        selector: "#password",
        value: "plain",
        credentialField: "password"
      })
    ).toThrowError(/either value or credentialField/);
  });

  it("validates action batches", () => {
    const parsed = runActionsRequestSchema.parse({
      actions: [
        {
          type: "navigate",
          url: "https://example.com"
        }
      ]
    });

    expect(parsed.actions).toHaveLength(1);
  });
});

