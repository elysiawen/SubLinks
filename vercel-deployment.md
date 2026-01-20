# Vercel 部署指南

SubLinks 完美支持 Vercel Serverless 部署，并针对 Vercel Edge Network 进行了深度优化。本指南将帮助您在几分钟内完成部署。

---

## ⚡ 快速部署

### 方式一：一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Felysiawen%2FSubLinks&env=DATABASE_TYPE,POSTGRES_URL,NEXT_PUBLIC_URL&project-name=sublinks&repository-name=sublinks)

点击上方按钮，Vercel 将自动：
1. Fork 项目到您的 GitHub 账户
2. 创建新的 Vercel 项目
3. 引导您配置环境变量
4. 自动构建和部署

### 方式二：手动部署

1. **Fork 项目**
   - 访问 https://github.com/elysiawen/SubLinks
   - 点击右上角 "Fork" 按钮

2. **导入到 Vercel**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Add New..." → "Project"
   - 选择您 fork 的 SubLinks 仓库
   - 点击 "Import"

3. **配置环境变量**（见下文）

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待构建完成（约 2-3 分钟）

---

## 🗄️ 数据库配置

SubLinks 需要 PostgreSQL 数据库。推荐以下方案：

### 选项 1：Vercel Postgres（推荐）

**优势**：与 Vercel 深度集成，自动注入环境变量，零配置。

1. 在 Vercel 项目页面，点击 "Storage" 选项卡
2. 点击 "Create Database" → 选择 "Postgres"
3. 输入数据库名称（如 `sublinks-db`）
4. 点击 "Create"
5. Vercel 会自动注入 `POSTGRES_URL` 等环境变量

### 选项 2：Neon（免费额度大）

**优势**：慷慨的免费额度，性能优异。

1. 访问 [Neon Console](https://console.neon.tech/)
2. 创建新项目
3. 复制连接字符串（Connection String）
4. 在 Vercel 项目设置中添加环境变量 `POSTGRES_URL`

### 选项 3：Supabase

**优势**：提供额外的实时数据库、认证等功能。

1. 访问 [Supabase Dashboard](https://app.supabase.com/)
2. 创建新项目
3. 进入 "Settings" → "Database"
4. 复制 "Connection string" (URI 格式)
5. 在 Vercel 项目设置中添加环境变量 `POSTGRES_URL`

---

## 🔧 环境变量配置

在 Vercel 项目设置中（Settings → Environment Variables），添加以下变量：

### 必需变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_TYPE` | 数据库类型 | `postgres` |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | `postgres://user:pass@host.neon.tech/dbname` |
| `NEXT_PUBLIC_URL` | **重要**：您的生产域名 | `https://your-project.vercel.app` |

> ⚠️ **重要**：`NEXT_PUBLIC_URL` 必须设置为您的实际 Vercel 域名（或自定义域名），否则 Cron Job 无法正常工作。

### 可选变量

| 变量名 | 说明 | 默认值 | 推荐值 |
|--------|------|--------|--------|
| `REDIS_URL` | Redis 连接字符串（使用 Redis 时） | - | - |
| `JWT_SECRET` | JWT 密钥（客户端 API） | 自动生成 | 强随机字符串 |

**生成随机密钥**：
```bash
# 在本地终端执行
openssl rand -base64 32
```

> **📝 系统配置说明**：日志保留天数、用户最大订阅数、刷新 API 密钥、S3 存储配置等都在 **管理后台 → 系统设置** 页面配置，存储在数据库中，不是环境变量。

---

## 🚀 部署后配置

### 1. 首次访问

部署完成后，访问您的站点：

```
https://your-project.vercel.app
```

### 2. 登录管理后台

访问管理后台：

```
https://your-project.vercel.app/admin
```

**默认管理员凭据**：
- 用户名：`admin`
- 密码：`admin`

> 🔒 **安全警告**：首次登录后，请立即进入 "设置" 修改密码！

### 3. 验证数据库连接

1. 登录后，进入 "用户管理" 页面
2. 如果能看到用户列表（至少有 admin 用户），说明数据库连接成功
3. 如果看到错误，检查 `POSTGRES_URL` 是否正确

### 4. 配置定时任务

SubLinks 使用 Vercel Cron 自动刷新上游源并预缓存节点。

**验证 Cron 配置**：

1. 检查项目根目录的 `vercel.json` 文件：
   ```json
   {
     "crons": [{
       "path": "/api/cron/refresh",
       "schedule": "*/30 * * * *"
     }]
   }
   ```

2. 在 Vercel Dashboard 中查看：
   - 进入项目 → "Settings" → "Cron Jobs"
   - 应该能看到 `/api/cron/refresh` 任务（每 30 分钟执行一次）

3. 查看执行日志：
   - 进入 "Logs" → "Cron Jobs"
   - 等待下一次执行（或手动触发）
   - 检查是否有错误

**手动触发刷新**：

访问以下 URL（需要配置 `REFRESH_API_KEY`）：

```
https://your-project.vercel.app/api/sources/refresh?key=YOUR_REFRESH_API_KEY
```

### 5. 添加上游源

1. 进入 "上游源管理"
2. 点击 "添加上游源"
3. 填写信息：
   - **名称**：如 "主力订阅"
   - **URL**：您的订阅链接
   - **缓存时长**：如 `1800`（30 分钟）
   - **User-Agent 白名单**：留空或填写特定 UA
4. 点击 "保存并更新" 立即获取节点

### 6. 创建用户订阅

1. 以普通用户身份登录（或创建新用户）
2. 进入 "用户中心"
3. 点击 "添加订阅"
4. 选择上游源、配置规则和策略组
5. 获取订阅链接并在 Clash 中使用

---

## 🎨 自定义域名（可选）

### 添加自定义域名

1. 在 Vercel 项目中，进入 "Settings" → "Domains"
2. 输入您的域名（如 `sub.example.com`）
3. 按照提示配置 DNS 记录：
   - **类型**：CNAME
   - **名称**：`sub`（或您的子域名）
   - **值**：`cname.vercel-dns.com`
4. 等待 DNS 生效（通常几分钟）

### 更新环境变量

添加域名后，务必更新 `NEXT_PUBLIC_URL`：

1. 进入 "Settings" → "Environment Variables"
2. 编辑 `NEXT_PUBLIC_URL`
3. 改为 `https://sub.example.com`
4. 保存并重新部署

---

## 🔍 故障排查

### 问题 1：部署后访问报错 500

**可能原因**：
- 数据库连接失败
- 环境变量配置错误

**解决方案**：
1. 检查 Vercel Logs（Functions 日志）
2. 验证 `POSTGRES_URL` 格式：
   ```
   postgres://username:password@host:port/database
   ```
3. 测试数据库连接：
   - 使用 `psql` 或数据库客户端连接
   - 确认用户名、密码、主机、端口、数据库名都正确

### 问题 2：Cron Job 不执行

**可能原因**：
- `NEXT_PUBLIC_URL` 未配置或错误
- Cron 路径配置错误

**解决方案**：
1. 检查 `NEXT_PUBLIC_URL` 是否为实际域名
2. 在 Vercel Dashboard → Logs → Cron Jobs 查看错误信息
3. 手动访问 `https://your-domain.com/api/cron/refresh` 测试
4. 确认 `vercel.json` 中的 cron 配置正确

### 问题 3：订阅链接无法访问

**可能原因**：
- 上游源未刷新
- 订阅配置错误

**解决方案**：
1. 进入 "上游源管理"，手动点击 "刷新" 按钮
2. 查看刷新日志，确认节点已成功获取
3. 检查订阅配置中是否选择了上游源
4. 访问订阅链接，查看返回的错误信息

### 问题 4：节点数为 0

**可能原因**：
- 上游源 URL 无效
- 上游源返回格式不支持
- 节点过滤规则过于严格

**解决方案**：
1. 检查上游源 URL 是否可访问
2. 手动访问上游源，确认返回的是 YAML 格式的 Clash 配置
3. 查看刷新日志中的错误信息
4. 调整订阅配置中的节点过滤规则

### 问题 5：函数执行超时

**可能原因**：
- 上游源响应慢
- 处理的节点数量过多

**解决方案**：
1. 检查 `vercel.json` 中的 `maxDuration` 配置
2. 升级 Vercel 套餐以获得更长的执行时间
3. 优化上游源数量和节点过滤规则
4. 使用 Edge Proxy 加速上游源下载

---

## 📊 性能优化

### 1. 启用 Edge Caching

在 `vercel.json` 中配置：

```json
{
  "headers": [
    {
      "source": "/api/sub/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=1800, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

### 2. 使用 Edge Functions

关键 API 路由已配置为 Edge Runtime，享受全球 CDN 加速。

### 3. 优化数据库查询

- 定期清理过期日志（通过 `LOG_RETENTION_DAYS`）
- 为常用查询字段添加索引

### 4. 监控性能

- 使用 Vercel Analytics 查看访问统计
- 查看 Functions 日志分析慢查询
- 监控数据库连接数和查询性能

---

## 🔐 安全最佳实践

1. ✅ **立即修改默认密码**
2. ✅ **配置 `REFRESH_API_KEY`** 保护刷新接口
3. ✅ **启用 HTTPS**（Vercel 默认启用）
4. ✅ **定期备份数据库**
5. ✅ **限制管理员数量**
6. ✅ **监控异常访问**（通过日志审计）
7. ✅ **使用强密码策略**
8. ✅ **定期更新依赖**

---

## 📞 获取帮助

- **GitHub Issues**: https://github.com/elysiawen/SubLinks/issues
- **文档**: 查看项目 README.md 和 API.md
- **日志**: 查看 Vercel Dashboard 中的 Functions 和 Cron Jobs 日志

---

## 🎉 部署成功！

恭喜！您已成功部署 SubLinks。现在可以：

1. ✅ 登录管理后台
2. ✅ 添加上游源
3. ✅ 创建订阅
4. ✅ 在 Clash 中使用

享受您的订阅管理系统吧！🚀
