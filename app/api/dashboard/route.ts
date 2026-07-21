import { env } from "cloudflare:workers";

const createTableSql = `CREATE TABLE IF NOT EXISTS dashboard_state (
  key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

async function ensureTable() {
  if (!env.DB) throw new Error("Dashboard storage is unavailable");
  await env.DB.prepare(createTableSql).run();
}

export async function GET() {
  try {
    await ensureTable();
    const row = await env.DB.prepare("SELECT payload FROM dashboard_state WHERE key = ?").bind("main").first<{ payload: string }>();
    return Response.json({ state: row ? JSON.parse(row.payload) : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load dashboard" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { state?: unknown };
    if (!body.state || typeof body.state !== "object") return Response.json({ error: "state is required" }, { status: 400 });
    await ensureTable();
    await env.DB.prepare(`INSERT INTO dashboard_state (key, payload, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`)
      .bind("main", JSON.stringify(body.state)).run();
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save dashboard" }, { status: 500 });
  }
}
