# Vercel 部署指南

SubLinks 完美支持 Vercel Serverless 部署，并针对 Vercel Edge Network 进行了深度优化。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Felysiawen%2FSubLinks&env=DATABASE_TYPE,POSTGRES_URL,NEXT_PUBLIC_URL&project-name=sublinks&repository-name=sublinks)

## ⚡ 快速部署

1. **点击上方按钮**：这将自动 fork 项目到您的 GitHub 并开始在 Vercel 上部署。
2. **配置数据库**：SubLinks 需要一个 PostgreSQL 数据库。
    - **推荐**：在 Vercel 部署过程中，添加 **Vercel Postgres** 集成（或使用 Neon、Supabase 等）。
    - 获取连接字符串（Connection String），通常形如 `postgres://...`。
3. **填写环境变量**：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_TYPE` | 数据库类型 | `postgres` |
| `POSTGRES_URL` | PostgreSQL 连接字符串 (如果使用 Vercel Postgres 可自动注入) | `postgres://user:pass@host:5432/db` |
| `NEXT_PUBLIC_URL` | **重要**：您的最终生产环境域名 (用于 Cron Job) | `https://your-project.vercel.app` |

**等待构建完成**：Vercel 会自动安装依赖并构建项目。

## 🛠️ 部署后配置

### 1. 初始化管理员账户
部署完成后，访问您的站点。默认并没有初始化数据库表结构。SubLinks 代码内置了适配 Vercel 的自动迁移逻辑，但建议您首次访问：
- 打开 `https://your-project.vercel.app/admin`
- 默认管理员账号：`admin`
- 默认管理员密码：`admin`

> **安全警告**：首次登录后，请务必立即在“设置”中修改密码！

### 2. 配置定时任务 (Cron Jobs)
SubLinks 使用 Vercel Cron 来自动刷新上游订阅源并预缓存节点。
- 项目根目录包含 `vercel.json`，其中已配置了 Cron 规则（每 30 分钟触发一次）。
- 确保 `NEXT_PUBLIC_URL` 环境变量已正确设置为您的 Vercel 域名。Cron Job 会向 `${NEXT_PUBLIC_URL}/api/cron/refresh` 发送请求。

## 常见问题

**Q: 部署后访问报错 500?**
A: 请检查 `POSTGRES_URL` 是否正确。如果是 Vercel Postgres，确保可以在 Vercel Dashboard 的 Storage 选项卡中查看到数据表。

**Q: 定时刷新没有生效?**
A: 检查 Vercel Dashboard 的 Logs -> Cron Jobs 页面。如果显示失败，通常是因为 `NEXT_PUBLIC_URL` 未配置或配置错误，导致 Cron 服务无法回调您的 API。
