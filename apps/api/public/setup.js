const state = {
  adminKey: "",
  allowlist: [],
  runtime: null
};

const sectionButtons = document.querySelectorAll("[data-section-target]");
const sections = document.querySelectorAll(".panel-section");
const sourceItems = document.querySelectorAll(".source-item");
const segmentButtons = document.querySelectorAll(".segment");

const adminKeyInput = document.querySelector("#admin-key");
const connectAdminButton = document.querySelector("#connect-admin");
const refreshStateButton = document.querySelector("#refresh-state");
const reloadAllowlistButton = document.querySelector("#reload-allowlist");
const allowlistForm = document.querySelector("#allowlist-form");
const credentialForm = document.querySelector("#credential-form");

const apiHealthPill = document.querySelector("#api-health-pill");
const healthChip = document.querySelector("#health-chip");
const healthCopy = document.querySelector("#health-copy");
const runtimeOrigin = document.querySelector("#runtime-origin");
const runtimeTtl = document.querySelector("#runtime-ttl");
const runtimeMaxSessions = document.querySelector("#runtime-max-sessions");
const runtimeDomainCount = document.querySelector("#runtime-domain-count");
const allowlistList = document.querySelector("#allowlist-list");
const allowlistCount = document.querySelector("#allowlist-count");
const credentialResult = document.querySelector("#credential-result");
const credentialStatusChip = document.querySelector("#credential-status-chip");
const consoleOutput = document.querySelector("#console-output");
const robloxSnippet = document.querySelector("#roblox-snippet");
const deployCommand = document.querySelector("#deploy-command");
const allowlistCommand = document.querySelector("#allowlist-command");

function logToConsole(message) {
  const timestamp = new Date().toLocaleTimeString();
  consoleOutput.textContent = `[${timestamp}] ${message}\n${consoleOutput.textContent}`;
}

function setVisibleSection(sectionId) {
  sections.forEach((section) => {
    section.classList.toggle("is-visible", section.id === sectionId);
  });

  sourceItems.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.sectionTarget === sectionId);
  });

  segmentButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.sectionTarget === sectionId);
  });
}

function renderRuntime() {
  runtimeOrigin.textContent = window.location.origin;
  runtimeTtl.textContent = state.runtime ? `${Math.round(state.runtime.sessionTtlMs / 1000)}s` : "-";
  runtimeMaxSessions.textContent = state.runtime ? String(state.runtime.maxSessions) : "-";
  runtimeDomainCount.textContent = String(state.allowlist.length);

  const snippet = [
    'local Bridgey = require(path.To.Bridgey)',
    "",
    "local client = Bridgey.new({",
    `\tbaseUrl = "${window.location.origin}",`,
    '\tapiKey = "REPLACE_WITH_EXPERIENCE_API_KEY",',
    "})",
    "",
    "local ok, result = client:fetchOnce({",
    "\t{",
    '\t\ttype = "navigate",',
    '\t\turl = "https://example.com",',
    "\t},",
    "\t{",
    '\t\ttype = "wait_for_selector",',
    '\t\tselector = "body",',
    "\t},",
    "})",
    "",
    "if ok then",
    "\tprint(result.snapshot.title)",
    "else",
    "\twarn(result.code, result.message)",
    "end"
  ].join("\n");

  robloxSnippet.textContent = snippet;
  deployCommand.textContent = "docker compose up -d --build";
  allowlistCommand.textContent = [
    `curl -X POST ${window.location.origin}/admin/allowlist \\`,
    "  -H 'content-type: application/json' \\",
    "  -H 'x-bridgey-admin-key: YOUR_ADMIN_KEY' \\",
    `  -d '{"action":"add","domain":"example.com"}'`
  ].join("\n");
}

function renderAllowlist() {
  allowlistCount.textContent = String(state.allowlist.length);
  runtimeDomainCount.textContent = String(state.allowlist.length);
  allowlistList.replaceChildren();

  if (state.allowlist.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "domain-empty";
    emptyItem.textContent = "No allowlisted domains yet.";
    allowlistList.appendChild(emptyItem);
    return;
  }

  state.allowlist.forEach((domain) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const chip = document.createElement("span");

    label.textContent = domain;
    chip.className = "panel-chip";
    chip.textContent = "Allowed";
    item.append(label, chip);
    allowlistList.appendChild(item);
  });
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (state.adminKey) {
    headers.set("x-bridgey-admin-key", state.adminKey);
  }

  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers
  });
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_error) {
      payload = {
        message: text
      };
    }
  }

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function refreshHealth() {
  try {
    await request("/health", {
      headers: {}
    });
    apiHealthPill.textContent = "API online";
    healthChip.textContent = "Healthy";
    healthCopy.textContent = "The API responded to /health and is ready for setup.";
    apiHealthPill.classList.remove("status-error");
    apiHealthPill.classList.add("status-ok");
    healthChip.classList.remove("status-error");
    healthChip.classList.add("status-ok");
  } catch (error) {
    apiHealthPill.textContent = "API unavailable";
    healthChip.textContent = "Unavailable";
    healthCopy.textContent = error instanceof Error ? error.message : "Health check failed.";
    apiHealthPill.classList.remove("status-ok");
    apiHealthPill.classList.add("status-error");
    healthChip.classList.remove("status-ok");
    healthChip.classList.add("status-error");
  }
}

async function refreshAdminState() {
  if (!state.adminKey) {
    logToConsole("Admin key is required before loading allowlist state.");
    return;
  }

  try {
    const runtime = await request("/admin/setup-state");
    state.runtime = runtime;
    state.allowlist = runtime.allowlist;
    renderRuntime();
    renderAllowlist();
    logToConsole(`Loaded setup state. ${runtime.allowlist.length} allowlisted domain(s).`);
  } catch (error) {
    logToConsole(error instanceof Error ? error.message : "Failed to load admin state.");
  }
}

sectionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setVisibleSection(button.dataset.sectionTarget);
  });
});

connectAdminButton.addEventListener("click", async () => {
  state.adminKey = adminKeyInput.value.trim();

  if (!state.adminKey) {
    logToConsole("Enter the admin key first.");
    return;
  }

  await refreshAdminState();
});

refreshStateButton.addEventListener("click", async () => {
  await refreshHealth();
  if (state.adminKey) {
    await refreshAdminState();
  }
});

reloadAllowlistButton.addEventListener("click", async () => {
  await refreshAdminState();
});

allowlistForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.adminKey) {
    logToConsole("Connect with the admin key before mutating the allowlist.");
    return;
  }

  const form = new FormData(allowlistForm);
  const action = event.submitter && event.submitter.value ? event.submitter.value : "add";
  const domain = String(form.get("domain") || "").trim();

  if (!domain) {
    logToConsole("Enter a domain first.");
    return;
  }

  try {
    await request("/admin/allowlist", {
      method: "POST",
      body: JSON.stringify({
        action,
        domain
      })
    });
    logToConsole(`${action === "add" ? "Added" : "Removed"} allowlist domain ${domain}.`);
    allowlistForm.reset();
    await refreshAdminState();
  } catch (error) {
    logToConsole(error instanceof Error ? error.message : "Allowlist update failed.");
  }
});

credentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.adminKey) {
    logToConsole("Connect with the admin key before creating credentials.");
    return;
  }

  const form = new FormData(credentialForm);
  const extrasInput = String(form.get("extras") || "").trim();
  let extras;

  try {
    extras = extrasInput ? JSON.parse(extrasInput) : undefined;
  } catch (_error) {
    logToConsole("Extras JSON is invalid.");
    credentialStatusChip.textContent = "Invalid JSON";
    return;
  }

  const payload = {
    label: String(form.get("label") || "").trim(),
    allowedDomains: String(form.get("allowedDomains") || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    payload: {
      username: String(form.get("username") || "").trim() || undefined,
      password: String(form.get("password") || "").trim() || undefined,
      extras
    }
  };

  try {
    const result = await request("/admin/credentials", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    credentialStatusChip.textContent = "Created";
    credentialResult.textContent = JSON.stringify(result, null, 2);
    credentialForm.reset();
    logToConsole(`Stored credential ${result.credentialRef}.`);
  } catch (error) {
    credentialStatusChip.textContent = "Error";
    credentialResult.textContent = error instanceof Error ? error.message : "Credential creation failed.";
    logToConsole(error instanceof Error ? error.message : "Credential creation failed.");
  }
});

setVisibleSection("setup-section");
renderRuntime();
renderAllowlist();
void refreshHealth();
