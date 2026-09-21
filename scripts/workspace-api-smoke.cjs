const assert = require("node:assert/strict");

const baseUrl = (process.env.POLAZU_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const password = "PolazuSmoke9!";

async function request(path, { cookie, expected = 200, ...init } = {}) {
  const headers = new Headers(init.headers || {});
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  if (response.status !== expected) {
    throw new Error(`${init.method || "GET"} ${path}: expected ${expected}, got ${response.status}: ${JSON.stringify(body)}`);
  }
  return { response, body };
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie");
  assert.ok(raw, "session cookie is missing");
  return raw.split(";", 1)[0];
}

async function signup(email, name, nickname) {
  const result = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name, nickname }),
  });
  return { cookie: sessionCookie(result.response), user: result.body };
}

(async () => {
  console.log(`POLAZU API smoke target: ${baseUrl}`);
  const owner = await signup(`owner-${suffix}@polazu.test`, "Smoke Owner", `owner-${suffix}`.slice(0, 40));
  const viewer = await signup(`viewer-${suffix}@polazu.test`, "Smoke Viewer", `viewer-${suffix}`.slice(0, 40));

  const created = await request("/api/projects", {
    method: "POST",
    cookie: owner.cookie,
    body: JSON.stringify({ name: `Smoke ${suffix}` }),
  });
  const projectId = created.body.id;
  assert.equal(created.body.currentRevision, 0);

  const snapshot = await request(`/api/projects/${projectId}/workspace`, { cookie: owner.cookie });
  assert.equal(snapshot.body.revision, 0);
  assert.ok(snapshot.body.files["/index.html"]);

  const mutationId = `smoke-save-${suffix}`;
  const change = {
    baseRevision: 0,
    clientMutationId: mutationId,
    summary: "Smoke HTML save",
    changes: [{ path: "/index.html", content: "<!doctype html><html><body><h1>Smoke saved</h1></body></html>", delete: false }],
  };
  const saved = await request(`/api/projects/${projectId}/workspace/changes?kind=CODE`, {
    method: "POST",
    cookie: owner.cookie,
    body: JSON.stringify(change),
  });
  assert.equal(saved.body.revision, 1);
  assert.equal(saved.body.duplicate, false);

  const duplicate = await request(`/api/projects/${projectId}/workspace/changes?kind=CODE`, {
    method: "POST",
    cookie: owner.cookie,
    body: JSON.stringify(change),
  });
  assert.equal(duplicate.body.revision, 1);
  assert.equal(duplicate.body.duplicate, true);

  const stale = await request(`/api/projects/${projectId}/workspace/changes?kind=CODE`, {
    method: "POST",
    cookie: owner.cookie,
    expected: 409,
    body: JSON.stringify({ ...change, clientMutationId: `stale-${suffix}` }),
  });
  assert.equal(stale.body.code, "REVISION_CONFLICT");

  await request(`/api/projects/${projectId}/members`, {
    method: "POST",
    cookie: owner.cookie,
    body: JSON.stringify({ email: viewer.user.email, role: "VIEWER" }),
  });
  await request(`/api/projects/${projectId}/workspace`, { cookie: viewer.cookie });
  const forbidden = await request(`/api/projects/${projectId}/workspace/changes?kind=CODE`, {
    method: "POST",
    cookie: viewer.cookie,
    expected: 403,
    body: JSON.stringify({
      baseRevision: 1,
      clientMutationId: `viewer-${suffix}`,
      summary: "Viewer must be blocked",
      changes: [{ path: "/viewer.txt", content: "blocked", delete: false }],
    }),
  });
  assert.equal(forbidden.body.code, "PROJECT_WRITE_FORBIDDEN");

  const version = await request(`/api/projects/${projectId}/versions`, {
    method: "POST",
    cookie: owner.cookie,
    body: JSON.stringify({ name: "Smoke checkpoint", summary: "Created by workspace-api-smoke.cjs" }),
  });
  assert.equal(version.body.sourceRevision, 1);

  const exported = await request(`/api/projects/${projectId}/export.zip`, { cookie: owner.cookie });
  assert.ok(exported.body.byteLength > 0, "exported ZIP is empty");

  await request(`/api/projects/${projectId}`, { method: "DELETE", cookie: owner.cookie });
  console.log(`PASS: auth, project creation, workspace save/idempotency/conflict, role enforcement, version and ZIP export (${projectId})`);
})().catch((error) => {
  console.error("FAIL:", error.stack || error);
  process.exit(1);
});
