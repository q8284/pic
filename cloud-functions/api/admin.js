import { getStore } from "@edgeone/pages-blob";

const BUILD_TAG = "v4-size";

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

function pickSize(item) {
  if (!item) return 0;
  if (typeof item.size === "number") return item.size;
  if (typeof item.length === "number") return item.length;
  if (typeof item.contentLength === "number") return item.contentLength;
  if (typeof item.byteLength === "number") return item.byteLength;
  return 0;
}

function formatList(blobs) {
  return blobs
    .filter(item => item && typeof item.key === "string" && item.key.startsWith("img/"))
    .map(item => ({
      key: item.key,
      name: item.key.replace(/^img\//, ""),
      size: pickSize(item)
    }))
    .sort((a, b) => a.name < b.name ? 1 : a.name > b.name ? -1 : 0);
}

async function readAsArrayBuffer(store, key) {
  try {
    const ab = await store.get(key, { type: "arrayBuffer", consistency: "strong" });
    if (ab && ab.byteLength) return ab;
  } catch (e) {}

  try {
    const obj = await store.get(key, { consistency: "strong" });
    if (!obj) return null;
    if (obj instanceof ArrayBuffer && obj.byteLength) return obj;
    if (typeof obj.arrayBuffer === "function") {
      const ab = await obj.arrayBuffer();
      if (ab && ab.byteLength) return ab;
    }
    if (obj.body) {
      const ab = await new Response(obj.body).arrayBuffer();
      if (ab && ab.byteLength) return ab;
    }
    if (typeof obj === "string") return new TextEncoder().encode(obj).buffer;
  } catch (e) {}

  return null;
}

async function resolveSize(store, key) {
  const metaAb = await readAsArrayBuffer(store, "meta/" + key);
  if (metaAb) {
    try {
      const parsed = JSON.parse(new TextDecoder().decode(metaAb));
      if (parsed && typeof parsed.size === "number" && parsed.size > 0) {
        return parsed.size;
      }
    } catch (e) {}
  }

  const ab = await readAsArrayBuffer(store, key);
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

  return 0;
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

export default async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const usernameEnv = readEnv(context, "ADMIN_USERNAME");
  const passwordEnv = readEnv(context, "ADMIN_PASSWORD");

  if (request.method === "GET") {
    const probe = url.searchParams.get("probe");
    const base = {
      success: true,
      build: BUILD_TAG,
      diagnose: {
        route: "ok",
        usernameConfigured: !!usernameEnv.value,
        passwordConfigured: !!passwordEnv.value,
        usernameSource: usernameEnv.source,
        passwordSource: passwordEnv.source
      }
    };

    if (probe === "1") {
      try {
        const store = getStore("img_store");
        const result = await store.list({ prefix: "img/", consistency: "strong" });
        const raw = (result && result.blobs) || [];
        const samples = raw.slice(0, 3).map(item => ({
          key: item.key,
          listSize: pickSize(item),
          rawFields: Object.keys(item || {})
        }));
        return json(Object.assign({}, base, { probe: { count: raw.length, samples: samples } }));
      } catch (e) {
        return json(Object.assign({}, base, { probeError: String(e && e.message ? e.message : e) }));
      }
    }

    return json(base);
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
    return json({ success: false, error: "仅支持 POST 或 GET", build: BUILD_TAG }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ success: false, error: "参数解析失败", build: BUILD_TAG }, 400);
  }

  if (!usernameEnv.value) {
    return json({ success: false, error: "服务端未配置 ADMIN_USERNAME 环境变量", build: BUILD_TAG }, 500);
  }

  if (!passwordEnv.value) {
    return json({ success: false, error: "服务端未配置 ADMIN_PASSWORD 环境变量", build: BUILD_TAG }, 500);
  }

  if (!checkCredential(body, usernameEnv.value, passwordEnv.value)) {
    return json({ success: false, error: "账号或密码错误", build: BUILD_TAG }, 401);
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

      return json({ success: true, build: BUILD_TAG, data: { files: files } });
    }

    if (body.action === "delete") {
      const key = String(body.key || "");
      if (!key.startsWith("img/")) {
        return json({ success: false, error: "非法路径", build: BUILD_TAG }, 400);
      }
      await store.delete(key);
      try {
        await store.delete("meta/" + key);
      } catch (e) {}
      return json({ success: true, build: BUILD_TAG });
    }

    return json({ success: false, error: "未知操作", build: BUILD_TAG }, 400);
  } catch (e) {
    return json({ success: false, error: "操作失败: " + (e && e.message ? e.message : e), build: BUILD_TAG }, 500);
  }
}
