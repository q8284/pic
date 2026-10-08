/**
 * EdgeOne Pages Functions - 图片管理 API
 *
 * GET    /api/images       获取图片列表
 * GET    /api/images/:id   获取单张图片信息
 * DELETE /api/images/:id   删除图片
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/images', '').replace(/^\//, '');

  if (path === '') {
    // 获取列表
    if (!env.IMAGE_KV) {
      return jsonResponse({ success: true, data: [], message: 'KV 未配置' });
    }

    // 从 KV 获取所有图片（简化实现：遍历已知前缀）
    const list = [];
    // 注意：KV list 有数量限制，生产环境建议分页
    const result = await env.IMAGE_KV.list({ prefix: 'meta:' });

    for (const key of result.keys) {
      const data = await env.IMAGE_KV.get(key.name);
      if (data) {
        try { list.push(JSON.parse(data)); } catch (_) {}
      }
    }

    // 按上传时间倒序
    list.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return jsonResponse({ success: true, data: list, total: list.length });
  }

  // 获取单张信息
  if (env.IMAGE_KV) {
    const data = await env.IMAGE_KV.get('meta:' + path);
    if (data) {
      return jsonResponse({ success: true, data: JSON.parse(data) });
    }
  }

  return jsonResponse({ success: false, error: '图片不存在' }, 404);
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const imageId = url.pathname.replace('/api/images/', '').replace('/api/images', '');

  if (!imageId) {
    return jsonResponse({ success: false, error: '缺少图片 ID' }, 400);
  }

  if (!env.IMAGE_KV) {
    return jsonResponse({ success: false, error: 'KV 未配置' }, 500);
  }

  await env.IMAGE_KV.delete('img:' + imageId);
  await env.IMAGE_KV.delete('meta:' + imageId);

  return jsonResponse({ success: true, message: '已删除' });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
