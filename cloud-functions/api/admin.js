import { getStore } from "@edgeone/pages-blob";

function readEnv(context, name) {
  if (typeof process !== "undefined" && process.env && process.env[name]) {
    return { value: process.env[name], source: "process.env" };
  }
  if (context && context.env && context.env[name]) {
    return { value: context.env[name], source: "context.env" };
  }
  return { value: undefined, source: "missing" };
}

const JSON_HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

function json(payload, status) {
  return new Response(JSON.stringify(payload), { status: status || 200, headers: JSON_HEADERS });
}

function checkCredential(body, username, password) {
  if (!body) return false;
  if (typeof body.username !== "string" || typeof body.password !== "string") return false;
  if (!username || !password) return false;
  return body.username === username && body.password === password;
}

function formatList(blobs) {
  return blobs
    .filter(item => item && typeof item.key === "string" && item.key.startsWith("img/"))
    .map(item => ({
      key: item.key,
      name: item.key.replace(/^img\//, ""),
      size: typeof item.size === "number" ? item.size : 0,
      uploaded: item.uploaded || item.uploadedAt || item.lastModified || null
    }))
    .sort((a, b) => a.name < b.name ? 1 : a.name > b.name ? -1 : 0);
}

async function mapLimit(list, limit, task) {
  const results = new Array(list.length);
  let cursor = 0;
  async function run() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(list[index]);
    }
  }
  const workers = [];
  const count = Math.min(limit, list.length);
  for (let i = 0; i < count; i += 1) workers.push(run());
  await Promise.all(workers);
  return results;
}

async function resolveSize(store, key) {
  try {
    const metaAb = await store.get("meta/" + key, { type: "arrayBuffer", consistency: "strong" });
    if (metaAb && metaAb.byteLength) {
      const parsed = JSON.parse(new TextDecoder().decode(metaAb));
      if (parsed && typeof parsed.size === "number" && parsed.size > 0) {
        return parsed.size;
      }
    }
  } catch (e) {}

  try {
    const ab = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
    if (ab && ab.byteLength) {
      const size = ab.byteLength;
      try {
        await store.set("meta/" + key, JSON.stringify({ size: size, uploadedAt: null }), {
          contentType: "application/json",
          consistency: "strong"
        });
      } catch (e) {}
      return size;
    }
  } catch (e) {}

  return 0;
}

export default async function onRequest(context) {
  const request = context.request;
  const usernameEnv = readEnv(context, "ADMIN_USERNAME");
  const passwordEnv = readEnv(context, "ADMIN_PASSWORD");

  if (request.method === "GET") {
    return json({
      success: true,
      diagnose: {
        route: "ok",
        usernameConfigured: !!usernameEnv.value,
        passwordConfigured: !!passwordEnv.value,
        usernameSource: usernameEnv.source,
        passwordSource: passwordEnv.source
      }
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method !== "POST") {
    return json({ success: false, error: "仅支持 POST 或 GET" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, error: "参数解析失败" }, 400);
  }

  if (!usernameEnv.value) {
    return json({ success: false, error: "服务端未配置 ADMIN_USERNAME 环境变量" }, 500);
  }

  if (!passwordEnv.value) {
    return json({ success: false, error: "服务端未配置 ADMIN_PASSWORD 环境变量" }, 500);
  }

  if (!checkCredential(body, usernameEnv.value, passwordEnv.value)) {
    return json({ success: false, error: "账号或密码错误" }, 401);
  }

  const store = getStore("img_store");

  try {
    if (body.action === "list") {
      const result = await store.list({ prefix: "img/", consistency: "strong" });
      const files = formatList((result && result.blobs) || []);

      await mapLimit(files, 5, async (file) => {
        if (!file.size) {
          file.size = await resolveSize(store, file.key);
        }
        return file;
      });

      return json({ success: true, data: { files } });
    }

    if (body.action === "delete") {
      const key = String(body.key || "");
      if (!key.startsWith("img/")) {
        return json({ success: false, error: "非法路径" }, 400);
      }
      await store.delete(key);
      try {
        await store.delete("meta/" + key);
      } catch (e) {}
      return json({ success: true });
    }

    return json({ success: false, error: "未知操作" }, 400);
  } catch (e) {
    return json({ success: false, error: "操作失败: " + (e && e.message ? e.message : e) }, 500);
  }
}
