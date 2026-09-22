import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../src/lib/fetch-all-rows.ts";

function database(rows, { cap = 1000, failAt = Infinity } = {}) {
  const requests = [];
  const client = createClient("https://pagination.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(input);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? cap);
        assert.match(new Headers(init.headers).get("prefer"), /count=exact/);
        assert.equal(url.searchParams.get("order"), "id.asc");
        requests.push(offset);
        if (offset >= failAt) {
          return new Response(JSON.stringify({ message: "Database unavailable", code: "XX000" }), {
            status: 500,
          });
        }
        const data = rows.slice(offset, offset + Math.min(limit, cap));
        return new Response(JSON.stringify(data), {
          headers: { "content-range": `${offset}-${offset + data.length - 1}/${rows.length}` },
        });
      },
    },
  });
  return {
    requests,
    query: () => client.from("orders").select("*", { count: "exact" }).order("id"),
  };
}

for (const size of [0, 21, 101, 500, 1000, 1251]) {
  test(`loads all ${size} rows and includes every sale in the total`, async () => {
    const rows = Array.from({ length: size }, (_, id) => ({ id, total: 10000 }));
    const { query } = database(rows);
    const result = await fetchAllRows(query);
    assert.equal(result.error, null);
    assert.deepEqual(result.data, rows);
    assert.equal(
      result.data.reduce((sum, order) => sum + order.total, 0),
      size * 10000,
    );
  });
}

test("continues when the server returns fewer rows than requested", async () => {
  const rows = Array.from({ length: 1211 }, (_, id) => ({
    id,
    status: id === 1200 ? "pending" : "delivered",
  }));
  const { query, requests } = database(rows, { cap: 73 });
  const { data, error } = await fetchAllRows(query);
  assert.equal(error, null);
  assert.deepEqual(data, rows);
  assert.equal(data.filter((order) => order.status === "pending").length, 1);
  assert.equal(requests[1], 73);
});

test("a failed later page never returns a partial total", async () => {
  const rows = Array.from({ length: 1251 }, (_, id) => ({ id, total: 10000 }));
  const { query } = database(rows, { failAt: 500 });
  const result = await fetchAllRows(query);
  assert.equal(result.data, null);
  assert.equal(result.error.code, "XX000");
});

test("rejects a response without a count instead of assuming it is complete", async () => {
  const result = await fetchAllRows(() => ({
    range: async () => ({ data: [{ id: 1 }], error: null, count: null }),
  }));
  assert.equal(result.data, null);
  assert.ok(result.error);
});

test("stops with an error if the server stops yielding rows before the total", async () => {
  const result = await fetchAllRows(() => ({
    range: async () => ({ data: [], error: null, count: 1 }),
  }));
  assert.equal(result.data, null);
  assert.ok(result.error);
});
