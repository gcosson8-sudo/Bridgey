import {
  documentSnapshotSchema,
  type CreateCredentialRequest,
  type DocumentSnapshot
} from "@bridgey/contracts";
import type { Pool } from "pg";

export interface PersistedSession {
  sessionId: string;
  expiresAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  snapshot: DocumentSnapshot | null;
}

export interface PersistedCredential {
  credentialRef: string;
  label: string;
  encryptedPayload: string;
  allowedDomains: string[];
}

export interface BridgeyStore {
  initialize(): Promise<void>;
  createSession(sessionId: string, expiresAt: string): Promise<PersistedSession>;
  getSession(sessionId: string): Promise<PersistedSession | null>;
  touchSession(sessionId: string, expiresAt: string, lastActivityAt: string): Promise<PersistedSession>;
  updateSessionSnapshot(sessionId: string, snapshot: DocumentSnapshot): Promise<void>;
  closeSession(sessionId: string, closedAt: string): Promise<void>;
  upsertCredential(
    credentialRef: string,
    request: CreateCredentialRequest,
    encryptedPayload: string
  ): Promise<void>;
  getCredential(credentialRef: string): Promise<PersistedCredential | null>;
  addAllowlistDomain(domain: string): Promise<void>;
  removeAllowlistDomain(domain: string): Promise<void>;
  listAllowlistDomains(): Promise<string[]>;
  recordAuditEvent(sessionId: string | null, eventType: string, payload: unknown): Promise<void>;
  closeExpiredSessions(now: string): Promise<string[]>;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS bridgey_sessions (
  session_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  last_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridgey_allowlist_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridgey_credentials (
  credential_ref UUID PRIMARY KEY,
  label TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  allowed_domains TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bridgey_audit_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bridgey_sessions_expiry_idx
  ON bridgey_sessions (expires_at)
  WHERE closed_at IS NULL;
`;

function mapSessionRow(row: {
  session_id: string;
  expires_at: Date | string;
  last_activity_at: Date | string;
  closed_at: Date | string | null;
  last_snapshot: unknown;
}): PersistedSession {
  const toIsoString = (value: Date | string): string =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();

  return {
    sessionId: row.session_id,
    expiresAt: toIsoString(row.expires_at),
    lastActivityAt: toIsoString(row.last_activity_at),
    closedAt: row.closed_at ? toIsoString(row.closed_at) : null,
    snapshot: row.last_snapshot
      ? documentSnapshotSchema.parse(row.last_snapshot)
      : null
  };
}

export class PostgresBridgeyStore implements BridgeyStore {
  public constructor(private readonly pool: Pool) {}

  public async initialize(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
  }

  public async createSession(sessionId: string, expiresAt: string): Promise<PersistedSession> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `
        INSERT INTO bridgey_sessions (session_id, expires_at, last_activity_at)
        VALUES ($1, $2, $3)
        RETURNING session_id, expires_at, last_activity_at, closed_at, last_snapshot
      `,
      [sessionId, expiresAt, now]
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to create Bridgey session");
    }

    return mapSessionRow(result.rows[0]);
  }

  public async getSession(sessionId: string): Promise<PersistedSession | null> {
    const result = await this.pool.query(
      `
        SELECT session_id, expires_at, last_activity_at, closed_at, last_snapshot
        FROM bridgey_sessions
        WHERE session_id = $1
      `,
      [sessionId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapSessionRow(result.rows[0]);
  }

  public async touchSession(
    sessionId: string,
    expiresAt: string,
    lastActivityAt: string
  ): Promise<PersistedSession> {
    const result = await this.pool.query(
      `
        UPDATE bridgey_sessions
        SET expires_at = $2, last_activity_at = $3
        WHERE session_id = $1 AND closed_at IS NULL
        RETURNING session_id, expires_at, last_activity_at, closed_at, last_snapshot
      `,
      [sessionId, expiresAt, lastActivityAt]
    );

    if (result.rowCount === 0) {
      throw new Error(`Failed to touch Bridgey session ${sessionId}`);
    }

    return mapSessionRow(result.rows[0]);
  }

  public async updateSessionSnapshot(
    sessionId: string,
    snapshot: DocumentSnapshot
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE bridgey_sessions
        SET last_snapshot = $2
        WHERE session_id = $1
      `,
      [sessionId, JSON.stringify(snapshot)]
    );
  }

  public async closeSession(sessionId: string, closedAt: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE bridgey_sessions
        SET closed_at = $2
        WHERE session_id = $1 AND closed_at IS NULL
      `,
      [sessionId, closedAt]
    );
  }

  public async upsertCredential(
    credentialRef: string,
    request: CreateCredentialRequest,
    encryptedPayload: string
  ): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO bridgey_credentials (
          credential_ref,
          label,
          encrypted_payload,
          allowed_domains,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (credential_ref)
        DO UPDATE SET
          label = EXCLUDED.label,
          encrypted_payload = EXCLUDED.encrypted_payload,
          allowed_domains = EXCLUDED.allowed_domains,
          updated_at = NOW()
      `,
      [credentialRef, request.label, encryptedPayload, request.allowedDomains]
    );
  }

  public async getCredential(credentialRef: string): Promise<PersistedCredential | null> {
    const result = await this.pool.query(
      `
        SELECT credential_ref, label, encrypted_payload, allowed_domains
        FROM bridgey_credentials
        WHERE credential_ref = $1
      `,
      [credentialRef]
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      credentialRef: row.credential_ref,
      label: row.label,
      encryptedPayload: row.encrypted_payload,
      allowedDomains: row.allowed_domains
    };
  }

  public async addAllowlistDomain(domain: string): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO bridgey_allowlist_domains (domain)
        VALUES ($1)
        ON CONFLICT (domain) DO NOTHING
      `,
      [domain]
    );
  }

  public async removeAllowlistDomain(domain: string): Promise<void> {
    await this.pool.query(
      `
        DELETE FROM bridgey_allowlist_domains
        WHERE domain = $1
      `,
      [domain]
    );
  }

  public async listAllowlistDomains(): Promise<string[]> {
    const result = await this.pool.query(
      `
        SELECT domain
        FROM bridgey_allowlist_domains
        ORDER BY domain ASC
      `
    );

    return result.rows.map((row: { domain: string }) => row.domain);
  }

  public async recordAuditEvent(
    sessionId: string | null,
    eventType: string,
    payload: unknown
  ): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO bridgey_audit_events (session_id, event_type, payload)
        VALUES ($1, $2, $3)
      `,
      [sessionId, eventType, JSON.stringify(payload ?? {})]
    );
  }

  public async closeExpiredSessions(now: string): Promise<string[]> {
    const result = await this.pool.query(
      `
        UPDATE bridgey_sessions
        SET closed_at = $1
        WHERE closed_at IS NULL AND expires_at <= $1
        RETURNING session_id
      `,
      [now]
    );

    return result.rows.map((row: { session_id: string }) => row.session_id);
  }
}
