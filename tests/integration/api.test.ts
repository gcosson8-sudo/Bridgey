import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URLSearchParams } from "node:url";

import { BrowserSessionManager, CredentialVault, PostgresBridgeyStore } from "@bridgey/browser-worker";
import type { DomNode } from "@bridgey/contracts";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const runIntegration =
  process.env.RUN_INTEGRATION === "1" && Boolean(process.env.INTEGRATION_DATABASE_URL);
const describeIntegration = runIntegration ? describe : describe.skip;

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function sendHtml(response: ServerResponse, body: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8"
  });
  response.end(body);
}

function findDomNodeById(node: DomNode, id: string): DomNode | null {
  if (node.id === id) {
    return node;
  }

  for (const child of node.children) {
    const match = findDomNodeById(child, id);

    if (match) {
      return match;
    }
  }

  return null;
}

describeIntegration("BrowserSessionManager integration", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let pool: Pool;
  let store: PostgresBridgeyStore;
  let manager: BrowserSessionManager;
  let credentialRef: string;

  beforeAll(async () => {
    const staticHtml = await fixture("static.html");
    const spaHtml = await fixture("spa.html");
    const loginHtml = await fixture("login.html");

    server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (!request.url) {
        response.writeHead(400);
        response.end();
        return;
      }

      const requestUrl = new URL(request.url, "http://127.0.0.1");

      if (request.method === "GET" && requestUrl.pathname === "/static") {
        sendHtml(response, staticHtml);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/spa") {
        sendHtml(response, spaHtml);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/login") {
        sendHtml(response, loginHtml);
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/login") {
        const chunks: Buffer[] = [];

        request.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        request.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const params = new URLSearchParams(body);
          const isValid =
            params.get("username") === "bridgey" && params.get("password") === "secret";

          if (!isValid) {
            response.writeHead(401, {
              "content-type": "text/html; charset=utf-8"
            });
            response.end("<p id='error'>Invalid credentials</p>");
            return;
          }

          response.writeHead(302, {
            location: "/account",
            "set-cookie": "bridgey_session=active; Path=/; HttpOnly"
          });
          response.end();
        });

        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/account") {
        const cookies = request.headers.cookie ?? "";

        if (!cookies.includes("bridgey_session=active")) {
          response.writeHead(401, {
            "content-type": "text/html; charset=utf-8"
          });
          response.end("<p id='not-authenticated'>Not authenticated</p>");
          return;
        }

        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8"
        });
        response.end("<main id='account'><h1>Signed in</h1><p>Protected page</p></main>");
        return;
      }

      response.writeHead(404);
      response.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Fixture server failed to bind");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
    pool = new Pool({
      connectionString: process.env.INTEGRATION_DATABASE_URL
    });
    store = new PostgresBridgeyStore(pool);
    manager = new BrowserSessionManager(
      store,
      CredentialVault.fromBase64(Buffer.alloc(32, 11).toString("base64")),
      {
        sessionTtlMs: 15_000,
        maxSessions: 10
      }
    );

    await manager.initialize();
    await store.addAllowlistDomain("127.0.0.1");

    credentialRef = "8f9be4f3-3dfc-4d6c-92f6-cd24ab40fd38";
    await store.upsertCredential(
      credentialRef,
      {
        label: "fixture login",
        allowedDomains: ["127.0.0.1"],
        payload: {
          username: "bridgey",
          password: "secret"
        }
      },
      CredentialVault.fromBase64(Buffer.alloc(32, 11).toString("base64")).encrypt({
        username: "bridgey",
        password: "secret"
      })
    );
  });

  afterAll(async () => {
    await manager.shutdown();
    await pool.end();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("navigates static and hydrated pages", async () => {
    const session = await manager.createSession();
    const result = await manager.runActions(session.sessionId, [
      {
        type: "navigate",
        url: `${baseUrl}/spa`
      },
      {
        type: "wait_for_selector",
        selector: "#hydrated"
      }
    ]);

    expect(result.snapshot.title).toBe("Bridgey SPA");
    expect(result.snapshot.textBlocks.some((block) => block.text.includes("Hydrated content"))).toBe(
      true
    );
    expect(result.snapshot.runtime.javascriptExecuted).toBe(true);
    expect(result.snapshot.runtime.stylesApplied).toBe(true);
    expect(result.snapshot.runtime.scripts.length).toBeGreaterThan(0);
    expect(result.snapshot.runtime.stylesheets.length).toBeGreaterThan(0);

    const hydratedNode = findDomNodeById(result.snapshot.dom, "#hydrated");

    expect(hydratedNode).not.toBeNull();
    expect(hydratedNode?.render?.visible).toBe(true);
    expect(hydratedNode?.render?.computedStyle.display).toBe("grid");
    expect(hydratedNode?.render?.layout.width ?? 0).toBeGreaterThan(0);
  });

  it("persists cookies across calls and supports credential-backed typing", async () => {
    const session = await manager.createSession();

    await manager.runActions(
      session.sessionId,
      [
        {
          type: "navigate",
          url: `${baseUrl}/login`
        },
        {
          type: "type",
          selector: "#username",
          credentialField: "username"
        },
        {
          type: "type",
          selector: "#password",
          credentialField: "password"
        },
        {
          type: "submit",
          selector: "#login-form"
        },
        {
          type: "wait_for_selector",
          selector: "#account"
        }
      ],
      credentialRef
    );

    const account = await manager.runActions(session.sessionId, [
      {
        type: "navigate",
        url: `${baseUrl}/account`
      }
    ]);

    expect(account.snapshot.textBlocks.some((block) => block.text.includes("Signed in"))).toBe(true);
  });

  it("rejects blocked domains before navigation", async () => {
    const session = await manager.createSession();

    await expect(
      manager.runActions(session.sessionId, [
        {
          type: "navigate",
          url: "https://not-allowlisted.invalid"
        }
      ])
    ).rejects.toMatchObject({
      code: "blocked_domain"
    });
  });

  it("maps selector errors to invalid_selector", async () => {
    const session = await manager.createSession();

    await manager.runActions(session.sessionId, [
      {
        type: "navigate",
        url: `${baseUrl}/static`
      }
    ]);

    await expect(
      manager.runActions(session.sessionId, [
        {
          type: "click",
          selector: "#missing-button",
          timeoutMs: 250
        }
      ])
    ).rejects.toMatchObject({
      code: "invalid_selector"
    });
  });
});
