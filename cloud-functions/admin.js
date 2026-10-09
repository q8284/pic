import { getStore } from "@edgeone/pages-blob";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const JSON_HEADERS = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

function json(payload, status) {
  return new Response(JSON.stringify(payload), { status: status || 200, headers: JSON_HEADERS });
}

function checkCredential(body) {
  if (!body) return false;
  if (typeof body.username !== "string" || typeof body.password !== "string") return false;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return false;
  return body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD;
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

export default async function onRequest(context) {
  const request = context.request;

  if (request.method === "GET") {
    return json({
      success: true,
      diagnose: {
        route: "ok",
        usernameConfigured: !!ADMIN_USERNAME,
        passwordConfigured: !!ADMIN_PASSWORD,
        usernameSource: ADMIN_USERNAME ? "env" : "missing"
      }
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (!ADMIN_USERNAME) {
    return json({ success: false, error: "服务端未配置 ADMIN_USERNAME 环境变量" }, 500);
  }

  if (!ADMIN_PASSWORD) {
    return json({ success: false, error: "服务端未配置 ADMIN_PASSWORD 环境变量" }, 500);
  }

  if (!checkCredential(body)) {
    return json({ success: false, error: "账号或密码错误" }, 401);
  }

  const store = getStore("img_store");

  try {
    if (body.action === "list") {
      const result = await store.list({ prefix: "img/", consistency: "strong" });
      const files = formatList((result && result.blobs) || []);
      return json({ success: true, data: { files } });
    }

    if (body.action === "delete") {
      const key = String(body.key || "");
      if (!key.startsWith("img/")) {
        return json({ success: false, error: "非法路径" }, 400);
      }
      await store.delete(key);
      return json({ success: true });
    }

    return json({ success: false, error: "未知操作" }, 400);
  } catch (e) {
    return json({ success: false, error: "操作失败: " + (e && e.message ? e.message : e) }, 500);
  }
}
