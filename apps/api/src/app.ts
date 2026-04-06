import { randomUUID } from "node:crypto";

import { fileURLToPath } from "node:url";

import {
  CredentialVault,
  BridgeyError,
  PostgresBridgeyStore,
  BrowserSessionManager,
  hostnameMatchesDomain,
  normalizeDomain
} from "@bridgey/browser-worker";
import {
  allowlistMutationRequestSchema,
  captureScreenshotRequestSchema,
  captureScreenshotResponseSchema,
  closeSessionResponseSchema,
  createCredentialRequestSchema,
  createCredentialResponseSchema,
  createSessionRequestSchema,
  getDocumentResponseSchema,
  runActionsRequestSchema,
  type AllowlistMutationResponse,
  type CaptureScreenshotResponse,
  type CloseSessionResponse
} from "@bridgey/contracts";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { Pool } from "pg";
import { ZodError } from "zod";

import type { BridgeyConfig } from "./config.js";

interface AppServices {
  config: BridgeyConfig;
  pool: Pool;
  store: PostgresBridgeyStore;
  vault: CredentialVault;
  manager: BrowserSessionManager;
}

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function requireApiKey(config: BridgeyConfig) {
  return async function guard(request: FastifyRequest): Promise<void> {
    const apiKey = getHeader(request, "x-bridgey-api-key");

    if (!apiKey || !config.apiKeys.has(apiKey)) {
      throw new BridgeyError("rate_limited", 401, "Missing or invalid Bridgey API key");
    }
  };
}

function requireAdminKey(config: BridgeyConfig) {
  return async function guard(request: FastifyRequest): Promise<void> {
    const adminKey = getHeader(request, "x-bridgey-admin-key");

    if (!adminKey || !config.adminKeys.has(adminKey)) {
      throw new BridgeyError("rate_limited", 401, "Missing or invalid Bridgey admin key");
    }
  };
}

function normalizeOptionalObjectBody(body: unknown): unknown {
  if (body == null) {
    return {};
  }

  // Roblox HttpService can serialize an empty Luau table as [], so treat an
  // empty array like an omitted object body.
  if (Array.isArray(body) && body.length === 0) {
    return {};
  }

  return body;
}

export async function buildApp(services: AppServices): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true
  });
  const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
  const apiGuard = requireApiKey(services.config);
  const adminGuard = requireAdminKey(services.config);

  await app.register(fastifyStatic, {
    root: publicRoot,
    prefix: "/assets/"
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BridgeyError) {
      void reply.status(error.statusCode).send(error.toResponseBody());
      return;
    }

    if (error instanceof ZodError) {
      void reply.status(400).send({
        code: "invalid_action",
        message: "Request validation failed",
        details: error.flatten()
      });
      return;
    }

    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : 500;

    if (statusCode < 500) {
      void reply.status(statusCode).send({
        code: "invalid_action",
        message:
          typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : "Request parsing failed"
      });
      return;
    }

    request.log.error(error);
    void reply.status(500).send({
      code: "invalid_action",
      message: "Unexpected server error"
    });
  });

  app.addHook("onClose", async () => {
    await services.manager.shutdown();
    await services.pool.end();
  });

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.get("/", async (_request, reply) => {
    return reply.redirect("/setup");
  });

  app.get("/setup", async (_request, reply) => {
    return reply.sendFile("setup.html");
  });

  app.post(
    "/sessions",
    {
      preHandler: apiGuard
    },
    async (request) => {
      const body = createSessionRequestSchema.parse(normalizeOptionalObjectBody(request.body));
      return services.manager.createSession(body.ttlMs);
    }
  );

  app.post(
    "/sessions/:id/actions",
    {
      preHandler: apiGuard
    },
    async (request) => {
      const body = runActionsRequestSchema.parse(request.body);
      const params = request.params as { id: string };
      return services.manager.runActions(params.id, body.actions, body.credentialRef);
    }
  );

  app.get(
    "/sessions/:id/document",
    {
      preHandler: apiGuard
    },
    async (request) => {
      const params = request.params as { id: string };
      const response = await services.manager.getDocument(params.id);
      return getDocumentResponseSchema.parse(response);
    }
  );

  app.post(
    "/sessions/:id/screenshot",
    {
      preHandler: apiGuard
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = captureScreenshotRequestSchema.parse(normalizeOptionalObjectBody(request.body));
      const response = await services.manager.captureScreenshot(params.id, body);

      return captureScreenshotResponseSchema.parse(response satisfies CaptureScreenshotResponse);
    }
  );

  app.delete(
    "/sessions/:id",
    {
      preHandler: apiGuard
    },
    async (request) => {
      const params = request.params as { id: string };
      const closedAt = new Date().toISOString();

      await services.manager.closeSession(params.id);

      return closeSessionResponseSchema.parse({
        sessionId: params.id,
        closedAt
      } satisfies CloseSessionResponse);
    }
  );

  app.post(
    "/admin/credentials",
    {
      preHandler: adminGuard
    },
    async (request, reply) => {
      const body = createCredentialRequestSchema.parse(request.body);
      const allowlist = await services.store.listAllowlistDomains();
      const normalizedDomains = body.allowedDomains.map(normalizeDomain);

      for (const domain of normalizedDomains) {
        const coveredByAllowlist = allowlist.some((allowedDomain) =>
          hostnameMatchesDomain(domain, allowedDomain)
        );

        if (!coveredByAllowlist) {
          throw new BridgeyError(
            "blocked_domain",
            400,
            `Credential domain ${domain} must be allowlisted before storing credentials`
          );
        }
      }

      const credentialRef = randomUUID();
      const encryptedPayload = services.vault.encrypt(body.payload);

      await services.store.upsertCredential(
        credentialRef,
        {
          ...body,
          allowedDomains: normalizedDomains
        },
        encryptedPayload
      );
      await services.store.recordAuditEvent(null, "admin.credential_stored", {
        credentialRef,
        label: body.label,
        allowedDomains: normalizedDomains
      });

      reply.status(201);

      return createCredentialResponseSchema.parse({
        credentialRef,
        allowedDomains: normalizedDomains
      });
    }
  );

  app.post(
    "/admin/allowlist",
    {
      preHandler: adminGuard
    },
    async (request) => {
      const body = allowlistMutationRequestSchema.parse(request.body);
      const domain = normalizeDomain(body.domain);

      if (body.action === "add") {
        await services.store.addAllowlistDomain(domain);
      } else {
        await services.store.removeAllowlistDomain(domain);
      }

      await services.store.recordAuditEvent(null, "admin.allowlist_updated", {
        action: body.action,
        domain
      });

      const response: AllowlistMutationResponse = {
        domain,
        allowed: body.action === "add"
      };

      return response;
    }
  );

  app.get(
    "/admin/setup-state",
    {
      preHandler: adminGuard
    },
    async () => {
      const allowlist = await services.store.listAllowlistDomains();

      return {
        allowlist,
        sessionTtlMs: services.config.sessionTtlMs,
        maxSessions: services.config.maxSessions
      };
    }
  );

  return app;
}

export async function createApp(config: BridgeyConfig): Promise<FastifyInstance> {
  const pool = new Pool({
    connectionString: config.databaseUrl
  });
  const store = new PostgresBridgeyStore(pool);
  const vault = CredentialVault.fromBase64(config.masterKey);
  const manager = new BrowserSessionManager(store, vault, {
    sessionTtlMs: config.sessionTtlMs,
    maxSessions: config.maxSessions
  });

  await manager.initialize();

  return buildApp({
    config,
    pool,
    store,
    vault,
    manager
  });
}
