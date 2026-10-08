# 🖼️ EdgeOne 图床

基于腾讯云 EdgeOne Pages 的免费图床，上传图片自动转换为 WebP 格式并返回直链。

## ✨ 特性

- **自动转 WebP**：上传任意格式图片，自动转换为 WebP，大幅减小体积
- **拖拽上传**：支持拖拽和多文件上传
- **即时返回**：上传完成立即返回直链、HTML、Markdown 三种格式
- **上传历史**：本地保存最近 20 张上传记录
- **API 支持**：提供 RESTful API，方便集成到第三方工具
- **边缘加速**：图片通过 EdgeOne 全球节点缓存，访问极快

## 📁 项目结构

```
edge-imgbed/
├── index.html                  # 主页面（上传 + 预览 + API 文档）
├── functions/
│   ├── api/
│   │   ├── upload.js           # 上传接口（接收 → 转WebP → 存KV）
│   │   └── images.js           # 图片管理（列表/详情/删除）
│   └── i/
│       └── [file].js           # 图片访问路由（/i/xxx.webp）
├── package.json
└── edgeone.json                # EdgeOne 配置
```

## 🌐 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传图片，自动转 WebP |
| GET | `/api/images` | 获取图片列表 |
| GET | `/api/images/:id` | 获取单张图片信息 |
| DELETE | `/api/images/:id` | 删除图片 |
| GET | `/i/:filename` | 访问图片文件 |

### 上传响应示例

```json
{
  "success": true,
  "data": {
    "url": "https://your-domain/i/abc123.webp",
    "id": "abc123",
    "filename": "abc123.webp",
    "size": 45231,
    "originalSize": 128456,
    "saved": 64.8
  }
}
```

### cURL 上传示例

```bash
curl -X POST "https://your-domain/api/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.png"
```

## ⚙️ 部署

### 1. 创建 KV 命名空间

在 EdgeOne 控制台创建 KV 命名空间，记录命名空间 ID。

### 2. 配置环境变量

编辑 `edgeone.json`，填入你的 KV 命名空间 ID：

```json
{
  "env": {
    "IMAGE_KV": {
      "binding": "IMAGE_KV",
      "type": "kv_namespace",
      "id": "你的命名空间ID"
    }
  }
}
```

### 3. 部署

1. 登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. **边缘 Pages** → 创建项目 → 关联 GitHub 仓库
3. 构建设置：
   - 框架预设：`Other`
   - 构建命令：**留空**
   - 输出目录：`/`
4. 环境变量中绑定 KV 命名空间
5. 部署完成，绑定自定义域名

### 4. 本地开发

```bash
# 安装 EdgeOne CLI
npm install -g @tencent/edgeone-pages-cli

# 登录
edgeone login

# 本地开发
edgeone dev
```

## 📝 配置说明

### 图片转换

当前使用 EdgeOne 内置的 `ImageTransformer`（如环境支持）进行 WebP 转换。如果环境不支持，会返回原始格式。

如需更高质量的转换，可以：
1. 使用 Cloudflare Images / EdgeOne 图像处理服务
2. 自建转换服务，通过 webhook 调用
3. 使用 wasm 版本的 `sharp` 或 `libwebp`

### 存储方案

- **KV**：适合小图片（单值限制 25MB），简单方便
- **R2**：适合大文件，推荐生产使用
- **GitHub**：类似 random-pic-api 方案，通过 API 提交

## 💡 使用方式

### 网页上传

直接访问首页，拖拽或点击选择图片即可。

### API 上传

```javascript
const form = new FormData();
form.append('file', fileInput.files[0]);

fetch('/api/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
  body: form
}).then(res => res.json()).then(console.log);
```

## 📄 License

MIT
