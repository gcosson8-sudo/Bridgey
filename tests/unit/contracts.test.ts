import { describe, expect, it } from "vitest";

import {
  actionSchema,
  documentSnapshotSchema,
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

  it("backfills runtime defaults for older snapshots", () => {
    const parsed = documentSnapshotSchema.parse({
      url: "https://example.com",
      title: "Example",
      status: 200,
      metadata: {
        description: null,
        lang: "en",
        readyState: "complete",
        contentType: "text/html",
        redirectedFrom: null
      },
      dom: {
        id: "#root",
        tag: "div",
        attributes: {},
        text: "Hello",
        interactiveHints: {
          clickable: false,
          typeable: false,
          formControl: false,
          role: null,
          href: null,
          inputType: null
        },
        children: []
      },
      links: [],
      forms: [],
      textBlocks: [],
      timestamp: "2026-04-06T10:00:00.000Z"
    });

    expect(parsed.runtime.javascriptExecuted).toBe(true);
    expect(parsed.runtime.stylesApplied).toBe(true);
    expect(parsed.runtime.scripts).toEqual([]);
    expect(parsed.dom.render?.visible).toBe(false);
    expect(parsed.dom.render?.layout.width).toBe(0);
  });
});
