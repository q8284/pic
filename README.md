# WebP 图床

基于腾讯云 EdgeOne Pages 的免费图床。上传图片自动转换为 WebP 格式，返回可直接访问的完整直链，支持拖拽上传。

在线地址：https://api.qjww.cn

## 特性

- 浏览器端自动将图片转换为 WebP 格式，大幅减小体积
- 上传后返回带完整域名的直链，复制即可用
- 支持拖拽上传与多文件批量上传
- 支持深色与浅色主题切换
- 本地保存最近 20 条上传记录
- 内置 API 接口说明与调用示例
- 图片存储于 EdgeOne Blob，边缘节点缓存加速

## 目录结构

```
.
├── index.html                     首页
├── package.json
├── README.md
└── cloud-functions/
    ├── upload.js                  上传接口
    └── img/
        └── [file].js              图片读取接口
```

## API 接口

### 上传图片

```
POST https://api.qjww.cn/upload
```

表单字段：`file`，值为转换后的 WebP 文件。

返回示例：

```json
{
  "success": true,
  "data": {
    "filename": "261009155901511.webp",
    "url": "https://api.qjww.cn/img/261009155901511.webp"
  }
}
```

### 读取图片

```
GET https://api.qjww.cn/img/:file
```

直接返回 WebP 二进制，响应头 `Content-Type: image/webp`，带一年缓存。

## 文件命名规则

文件名由上传时间的北京时间生成，格式为 `年月日时分秒毫秒.webp`：

```
261009155901511.webp
26 年 10 月 09 日 15 时 59 分 01 秒 511 毫秒
```

小时随实际上传时刻变化，例如 16 点上传即以 `16` 开头。毫秒位保证同一时刻并发上传不会重名。

## 部署步骤

1. 在 GitHub 创建仓库并上传本目录全部文件
2. 登录腾讯云 EdgeOne 控制台，进入 Makers
3. 创建 Pages 项目并关联该 GitHub 仓库
4. 构建设置：框架预设选 `Other`，构建命令留空，输出目录填 `/`
5. 等待首次部署完成，Blob 存储会在第一次上传时自动创建，无需手动新建命名空间
6. 绑定自定义域名 `api.qjww.cn`

## 注意事项

- 代码中的 `DOMAIN` 常量已写死为 `https://api.qjww.cn`，更换域名需同步修改 `cloud-functions/upload.js` 顶部该常量
- Blob 存储空间名为 `img_store`，写入与读取两端必须一致
- 原图上传上限为 10 MB，由前端过滤，超过的文件会被自动跳过
- 图片转换在浏览器端完成，边缘函数仅负责写入与读取，不参与转码

## 本地预览

直接打开 `index.html` 仅能查看界面，上传功能需部署到 EdgeOne 后可用。

## License

MIT
