import "dotenv/config";

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);

  await app.listen({
    host: config.host,
    port: config.port
  });
}

void main();
