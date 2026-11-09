import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { id: string } | null = null;
const applied: unknown[] = [];
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "x".repeat(40));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: () => { applied.push(1); throw new Error("db"); } }) }));

import { NextRequest } from "next/server";
const { proxy } = await import("@/proxy");
const { POST } = await import("@/app/api/sync/route");
const { POST: del } = await import("@/app/api/account/delete/route");
const req = (path: string) => new NextRequest(`http://localhost:3000${path}`);
const post = (body: unknown) => new Request("http://x/api/sync", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => { user = null; applied.length = 0; });

describe("authentication gate (proxy)", () => {
  it("redirects signed-out visitors to sign-in and remembers where they were going", async () => {
    const r = await proxy(req("/workout?letter=A"));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/auth/sign-in");
    expect(new URL(r.headers.get("location")!).searchParams.get("next")).toBe("/workout?letter=A");
  });
  it("session expiry behaves like signed-out", async () => { user = { id: "u" }; expect((await proxy(req("/"))).status).toBe(200); user = null; expect((await proxy(req("/"))).status).toBe(307); });
  it("lets public pages through and gives APIs a 401, not a redirect", async () => {
    for (const p of ["/auth/sign-in", "/privacy", "/terms", "/offline", "/sw.js", "/manifest.webmanifest"]) expect((await proxy(req(p))).status, p).toBe(200);
    expect((await proxy(req("/api/sync"))).status).toBe(401);
  });
  it("allows signed-in users through", async () => { user = { id: "u" }; expect((await proxy(req("/progress"))).status).toBe(200); });
});

describe("unauthorised access is rejected by the API", () => {
  it("sync: 401 without a session and never touches the database", async () => {
    expect((await POST(post({ ops: [] }))).status).toBe(401); expect(applied).toHaveLength(0);
  });
  it("sync: signed-in but malformed or oversized input is rejected before any database work", async () => {
    user = { id: "u" };
    expect((await POST(post({ ops: [] }))).status).toBe(400);
    expect((await POST(post({ ops: [{ opId: "x" }], userId: "someone-else" }))).status).toBe(400);
    expect(applied).toHaveLength(0);
  });
  it("sync: a client-supplied user id is never accepted (strict schema)", async () => {
    user = { id: "u" };
    const op = { opId: crypto.randomUUID(), entity: "journal", id: crypto.randomUUID(), action: "delete", clientUpdatedAt: new Date().toISOString(), userId: "victim" };
    expect((await POST(post({ ops: [op] }))).status).toBe(400);
  });
  it("account deletion needs a session and explicit confirmation", async () => {
    const body = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
    expect((await del(body({ confirm: "DELETE" }))).status).toBe(401);
    user = { id: "u" };
    expect((await del(body({ confirm: "yes" }))).status).toBe(400);
  });
});
