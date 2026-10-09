// POST /upload
// 接收前端传来的 webp 文件，存 KV，返回链接

export async function onRequestPost(ctx) {
  const { request, env } = ctx;

  // 鉴权（可选，取消注释启用）
  // const auth = request.headers.get('X-API-Key');
  // if (auth !== env.ADMIN_KEY) {
  //   return new Response(JSON.stringify({ error: 'Unauthorized' }), {
  //     status: 401,
  //     headers: { 'Content-Type': 'application/json' }
  //   });
  // }

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 验证是 webp
  if (!file.type.includes('webp') && !file.name.endsWith('.webp')) {
    return new Response(JSON.stringify({ error: 'Please upload WebP format only. Use the page to convert first.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 大小限制 5MB（KV 单值上限）
  if (file.size > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large. Max 5MB.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 生成唯一文件名
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const filename = `${id}.webp`;

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();

  // 存入 KV
  await env.IMG_KV.put(`img:${filename}`, arrayBuffer, {
    metadata: {
      type: 'image/webp',
      size: file.size,
      uploadedAt: new Date().toISOString()
    }
  });

  // 更新计数
  let count = 0;
  const countRaw = await env.IMG_KV.get('__count__');
  if (countRaw) count = parseInt(countRaw);
  await env.IMG_KV.put('__count__', (count + 1).toString());

  // 返回结果
  const baseUrl = new URL(request.url).origin;
  const imageUrl = `${baseUrl}/i/${filename}`;

  return new Response(JSON.stringify({
    success: true,
    data: {
      url: imageUrl,
      filename: filename,
      size: file.size,
      html: `<img src="${imageUrl}" alt="upload" />`,
      markdown: `![upload](${imageUrl})`
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

// OPTIONS 预检
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key'
    }
  });
}
