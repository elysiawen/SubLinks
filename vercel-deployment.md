# Vercel 部署指南

本指南将帮助您将 SubLinks 部署到 Vercel 平台。

## 一键部署

您可以使用下面的按钮一键将项目部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/elysiawen/SubLinks&env=DATABASE_TYPE,POSTGRES_URL,NEXT_PUBLIC_URL)

**注意**：请将 URL 中的 `your-repo` 替换为实际的仓库地址。

## 手动部署

1.  **Fork 本仓库**
    将本项目 Fork 到您的 GitHub 账号下。

2.  **在 Vercel 中导入项目**
    - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
    - 点击 "Add New..." -> "Project"
    - 选择刚刚 Fork 的仓库并点击 "Import"

3.  **配置环境变量**
    在 "Configure Project" 页面，设置以下环境变量：

    | 变量名 | 说明 | 示例 |
    |--------|------|------|
    | `DATABASE_TYPE` | 数据库类型 | `postgres` (推荐) 或 `redis` |
    | `POSTGRES_URL` | PostgreSQL 连接串 | `postgresql://...` (推荐使用 Vercel Storage) |
    | `NEXT_PUBLIC_URL` | 您的 Vercel 域名 | `https://your-project.vercel.app` |

    > **关于数据库**：推荐直接在 Vercel 可以在项目设置页面的 "Storage" 选项卡中创建一个 Vercel Postgres 数据库，它会自动填充相关环境变量。

4.  **点击 Deploy**
    等待部署完成。

5.  **后续配置**
    部署完成后，请进入 Settings -> General，找到您的具体域名（或绑定自定义域名），确保与环境变量 `NEXT_PUBLIC_URL` 一致。

## Cron 定时任务配置

本项目已经配置了 `vercel.json` 以启用 Cron 定时任务（用于自动刷新上游源）。
- 默认设置为每天 UTC 时间 17:00 (北京时间凌晨 1:00) 执行。
- 您可以在 `vercel.json` 中修改 Cron 表达式。

**关键点**：Cron 任务依赖 `NEXT_PUBLIC_URL` 来回调自身的 API 接口 `/api/sources/refresh`。请务必确保该环境变量设置正确，否则定时刷新将失败。

## Edge Function 注意事项

本项目使用了 Edge Runtime 来处理订阅请求以降低延迟。
- 确保您的数据库连接支持 Serverless 环境（Vercel Postgres 和 Neon 均原生支持）。
- 如果使用 Redis，请确保使用的是 Upstash 等支持 HTTP/Serverless 连接的服务。
