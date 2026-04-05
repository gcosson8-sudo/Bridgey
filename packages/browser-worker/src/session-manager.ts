import { randomUUID } from "node:crypto";

import {
  type Action,
  type CreateSessionResponse,
  type CredentialPayload,
  type DocumentSnapshot,
  type GetDocumentResponse,
  type RunActionsResponse,
  type SessionState
} from "@bridgey/contracts";
import {
  Browser,
  BrowserContext,
  Page,
  errors,
  chromium
} from "playwright";

import { assertUrlAllowed, hostnameMatchesDomain, normalizeDomain } from "./allowlist.js";
import { CredentialVault } from "./credential-vault.js";
import { captureDocumentSnapshot } from "./dom-normalizer.js";
import { BridgeyError } from "./errors.js";
import type {
  BridgeyStore,
  PersistedCredential
} from "./postgres-store.js";

interface BrowserSessionManagerOptions {
  sessionTtlMs: number;
  maxSessions: number;
}

interface LiveSession {
  sessionId: string;
  context: BrowserContext;
  page: Page;
  expiresAt: Date;
  lastActivityAt: Date;
  lastSnapshot: DocumentSnapshot | null;
  lastStatus: number | null;
  redirectedFrom: string | null;
  credentialScope: string[] | null;
}

export class BrowserSessionManager {
  private readonly sessions = new Map<string, LiveSession>();
  private browser: Browser | null = null;

  public constructor(
    private readonly store: BridgeyStore,
    private readonly vault: CredentialVault,
    private readonly options: BrowserSessionManagerOptions
  ) {}

  public async initialize(): Promise<void> {
    await this.store.initialize();
    this.browser = await chromium.launch({ headless: true });
  }

  public async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.sessions.values()).map(async (session) => {
        await session.context.close();
      })
    );
    this.sessions.clear();
    await this.browser?.close();
    this.browser = null;
  }

  public async createSession(ttlMs = this.options.sessionTtlMs): Promise<CreateSessionResponse> {
    await this.reapExpiredSessions();

    if (this.sessions.size >= this.options.maxSessions) {
      throw new BridgeyError("rate_limited", 429, "Too many active Bridgey sessions");
    }

    const browser = this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await this.store.createSession(sessionId, expiresAt.toISOString());
    await this.store.recordAuditEvent(sessionId, "session.created", {
      ttlMs,
      createdAt: now.toISOString()
    });

    this.sessions.set(sessionId, {
      sessionId,
      context,
      page,
      expiresAt,
      lastActivityAt: now,
      lastSnapshot: null,
      lastStatus: null,
      redirectedFrom: null,
      credentialScope: null
    });

    return {
      sessionId,
      expiresAt: expiresAt.toISOString()
    };
  }

  public async runActions(
    sessionId: string,
    actions: Action[],
    credentialRef?: string
  ): Promise<RunActionsResponse> {
    const session = await this.requireSession(sessionId);
    const credential = credentialRef ? await this.resolveCredential(credentialRef) : null;

    if (credential) {
      session.credentialScope = credential.record.allowedDomains;
    }

    for (const action of actions) {
      try {
        switch (action.type) {
          case "navigate": {
            const allowlistDomains = await this.store.listAllowlistDomains();
            assertUrlAllowed(action.url, allowlistDomains);

            if (session.credentialScope) {
              const requestedHost = normalizeDomain(new URL(action.url).hostname);
              const withinCredentialScope = session.credentialScope.some((domain) =>
                hostnameMatchesDomain(requestedHost, domain)
              );

              if (!withinCredentialScope) {
                throw new BridgeyError(
                  "blocked_domain",
                  403,
                  "Requested URL is outside the credential's allowed domains"
                );
              }
            }

            const response = await session.page.goto(action.url, {
              waitUntil: action.waitUntil ?? "networkidle",
              timeout: action.timeoutMs ?? 20_000
            });

            session.lastStatus = response?.status() ?? null;
            session.redirectedFrom =
              response?.request().redirectedFrom()?.url() ?? session.redirectedFrom;

            break;
          }

          case "click": {
            const response = await this.runNavigationAwareAction(
              session.page,
              action.timeoutMs,
              async () => {
                await session.page.locator(action.selector).click({
                  timeout: action.timeoutMs ?? 10_000
                });
              }
            );

            session.lastStatus = response?.status() ?? session.lastStatus;
            break;
          }

          case "type": {
            const value = this.resolveTypeValue(action.value, action.credentialField, credential);
            const locator = session.page.locator(action.selector);

            if (action.clearBeforeType !== false) {
              await locator.fill("", {
                timeout: action.timeoutMs ?? 10_000
              });
            }

            await locator.type(value, {
              timeout: action.timeoutMs ?? 10_000
            });
            break;
          }

          case "submit": {
            const response = await this.runNavigationAwareAction(
              session.page,
              action.timeoutMs,
              async () => {
                await session.page.locator(action.selector).evaluate((element) => {
                  if (element instanceof HTMLFormElement) {
                    element.requestSubmit();
                    return;
                  }

                  const form = element.closest("form");

                  if (!form) {
                    throw new Error("Element is not inside a form");
                  }

                  (form as HTMLFormElement).requestSubmit();
                });
              }
            );

            session.lastStatus = response?.status() ?? session.lastStatus;
            break;
          }

          case "wait_for_selector": {
            await session.page.locator(action.selector).waitFor({
              state: action.state ?? "visible",
              timeout: action.timeoutMs ?? 10_000
            });
            break;
          }
        }

        await this.enforceCurrentPageAllowlisted(session);
      } catch (error) {
        throw this.mapAutomationError(error, action);
      }
    }

    const now = new Date();
    session.lastActivityAt = now;
    session.expiresAt = new Date(now.getTime() + this.options.sessionTtlMs);
    session.lastSnapshot = await captureDocumentSnapshot(session.page, {
      status: session.lastStatus,
      redirectedFrom: session.redirectedFrom
    });

    await this.store.touchSession(
      session.sessionId,
      session.expiresAt.toISOString(),
      session.lastActivityAt.toISOString()
    );
    await this.store.updateSessionSnapshot(session.sessionId, session.lastSnapshot);
    await this.store.recordAuditEvent(session.sessionId, "session.actions_executed", {
      count: actions.length
    });

    return {
      session: this.toSessionState(session),
      snapshot: session.lastSnapshot
    };
  }

  public async getDocument(sessionId: string): Promise<GetDocumentResponse> {
    const session = await this.requireSession(sessionId);
    const snapshot =
      session.lastSnapshot ??
      (await captureDocumentSnapshot(session.page, {
        status: session.lastStatus,
        redirectedFrom: session.redirectedFrom
      }));

    session.lastSnapshot = snapshot;
    session.lastActivityAt = new Date();
    session.expiresAt = new Date(session.lastActivityAt.getTime() + this.options.sessionTtlMs);

    await this.store.touchSession(
      session.sessionId,
      session.expiresAt.toISOString(),
      session.lastActivityAt.toISOString()
    );
    await this.store.updateSessionSnapshot(session.sessionId, snapshot);

    return {
      session: this.toSessionState(session),
      snapshot
    };
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);

    await session.context.close();
    this.sessions.delete(sessionId);
    await this.store.closeSession(sessionId, new Date().toISOString());
    await this.store.recordAuditEvent(sessionId, "session.closed", {});
  }

  private getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("BrowserSessionManager was not initialized");
    }

    return this.browser;
  }

  private toSessionState(session: LiveSession): SessionState {
    return {
      sessionId: session.sessionId,
      expiresAt: session.expiresAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString()
    };
  }

  private async reapExpiredSessions(): Promise<void> {
    const now = new Date();

    for (const session of this.sessions.values()) {
      if (session.expiresAt <= now) {
        await session.context.close();
        this.sessions.delete(session.sessionId);
      }
    }

    await this.store.closeExpiredSessions(now.toISOString());
  }

  private async requireSession(sessionId: string): Promise<LiveSession> {
    await this.reapExpiredSessions();

    const session = this.sessions.get(sessionId);

    if (session) {
      return session;
    }

    const persisted = await this.store.getSession(sessionId);

    if (!persisted || persisted.closedAt) {
      throw new BridgeyError("session_expired", 404, "Bridgey session was not found");
    }

    if (new Date(persisted.expiresAt) <= new Date()) {
      throw new BridgeyError("session_expired", 410, "Bridgey session has expired");
    }

    throw new BridgeyError(
      "session_expired",
      410,
      "Bridgey session is not active on this node and cannot be resumed"
    );
  }

  private async resolveCredential(credentialRef: string): Promise<{
    payload: CredentialPayload;
    record: PersistedCredential;
  }> {
    const record = await this.store.getCredential(credentialRef);

    if (!record) {
      throw new BridgeyError("login_failed", 404, "Credential reference was not found");
    }

    return {
      payload: this.vault.decrypt(record.encryptedPayload),
      record
    };
  }

  private resolveTypeValue(
    explicitValue: string | undefined,
    credentialField: string | undefined,
    credential:
      | {
          payload: CredentialPayload;
          record: PersistedCredential;
        }
      | null
  ): string {
    if (explicitValue !== undefined) {
      return explicitValue;
    }

    if (!credentialField || !credential) {
      throw new BridgeyError(
        "login_failed",
        400,
        "Credential-backed type action requires a credentialRef"
      );
    }

    const extras = credential.payload.extras ?? {};
    const value =
      credentialField === "username"
        ? credential.payload.username
        : credentialField === "password"
          ? credential.payload.password
          : extras[credentialField];

    if (!value) {
      throw new BridgeyError(
        "login_failed",
        400,
        `Credential field "${credentialField}" is not available`
      );
    }

    return value;
  }

  private async runNavigationAwareAction(
    page: Page,
    timeoutMs = 10_000,
    run: () => Promise<void>
  ) {
    const navigation = page
      .waitForNavigation({
        timeout: timeoutMs,
        waitUntil: "load"
      })
      .catch((error) => {
        if (error instanceof errors.TimeoutError) {
          return null;
        }

        throw error;
      });

    await run();
    await page.waitForLoadState("networkidle", {
      timeout: timeoutMs
    }).catch((error) => {
      if (!(error instanceof errors.TimeoutError)) {
        throw error;
      }
    });

    return await navigation;
  }

  private async enforceCurrentPageAllowlisted(session: LiveSession): Promise<void> {
    const allowlist = await this.store.listAllowlistDomains();
    const currentUrl = session.page.url();

    if (currentUrl === "about:blank") {
      return;
    }

    assertUrlAllowed(currentUrl, allowlist);

    const currentHost = normalizeDomain(new URL(currentUrl).hostname);

    if (!session.credentialScope) {
      return;
    }

    const matchesCredentialScope = session.credentialScope.some((domain) =>
      hostnameMatchesDomain(currentHost, domain)
    );

    if (!matchesCredentialScope) {
      throw new BridgeyError(
        "blocked_domain",
        403,
        "Page navigated outside the credential's allowed domains"
      );
    }
  }

  private mapAutomationError(error: unknown, action: Action): BridgeyError {
    if (error instanceof BridgeyError) {
      return error;
    }

    if (error instanceof errors.TimeoutError) {
      return new BridgeyError("navigation_timeout", 504, "Browser action timed out", {
        action
      });
    }

    if (error instanceof Error && /selector|locator|form/iu.test(error.message)) {
      return new BridgeyError("invalid_selector", 400, error.message, { action });
    }

    return new BridgeyError("invalid_action", 400, "Browser action failed", {
      action,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
