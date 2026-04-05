function splitEnvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export interface BridgeyConfig {
  host: string;
  port: number;
  databaseUrl: string;
  masterKey: string;
  apiKeys: Set<string>;
  adminKeys: Set<string>;
  sessionTtlMs: number;
  maxSessions: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeyConfig {
  const databaseUrl = env.DATABASE_URL;
  const masterKey = env.BRIDGEY_MASTER_KEY;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!masterKey) {
    throw new Error("BRIDGEY_MASTER_KEY is required");
  }

  return {
    host: env.HOST ?? "0.0.0.0",
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    masterKey,
    apiKeys: new Set(splitEnvList(env.BRIDGEY_API_KEYS)),
    adminKeys: new Set(splitEnvList(env.BRIDGEY_ADMIN_KEYS)),
    sessionTtlMs: Number(env.BRIDGEY_SESSION_TTL_MS ?? 900_000),
    maxSessions: Number(env.BRIDGEY_MAX_SESSIONS ?? 50)
  };
}

