# SubLinks

**强大的订阅链接管理与分发系统**

SubLinks 是一个现代化的订阅管理系统，专为 Clash 等代理工具设计，提供灵活的订阅链接管理、多上游源支持、自定义规则和策略组等功能，并完美适配 Vercel Serverless 环境。

## ✨ 主要特性

- **🚀 Vercel 深度适配** - 支持 Edge Proxy 代理、Cron 定时任务预缓存、Serverless 异步任务优化
- **📝 增强型日志审计** - 详细记录 API 类型、请求方式 (GET/POST)、认证类型 (Bearer/Token) 及 Token 验证
- **📡 动态上游源管理** - 数据库级上游源管理，支持 Web 界面增删改查、流式实时刷新监控
- **🔐 多维度用户权限** - 完善的用户/管理员角色体系，支持多用户独立订阅管理
- **🎨 灵活配置生成** - 支持自定义策略组、分流规则，智能合并多上游源节点
- **📊 实时数据分析** - 可视化查看节点分布、策略组结构、规则统计
- **🔄 智能更新机制** - 支持定时自动更新、API 触发刷新 (支持鉴权)、手动实时刷新
- **📱 全端响应式 UI** - 适配桌面端和移动端的现代化管理界面

## 🚀 快速开始

### 本地开发

1. **克隆项目**
```bash
git clone <your-repo-url>
cd sublinks
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

创建 `.env.local` 文件：
```env
DATABASE_TYPE=postgres
# PostgreSQL 连接 (必需)
POSTGRES_URL=postgresql://user:password@localhost:5432/sublinks
# JWT 签名密钥 (必需)
JWT_SECRET=your-random-secret-key
# 站点地址 (用于 Cron 预缓存自调用)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
- 打开 http://localhost:3000
- 使用 `admin/admin` 来登录

### 部署到 Vercel

详见 [Vercel 部署指南](./vercel-deployment.md)

**注意**：在 Vercel 部署时，请务必配置 `NEXT_PUBLIC_SITE_URL` 为您的实际访问域名（例如 `https://your-app.vercel.app`），以确保定时任务能正确通过公网触发预缓存。

## 📦 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + Shadcn UI 风格
- **数据库**: PostgreSQL (推荐 Neon/Vercel Postgres) / Redis
- **认证**: JWT + bcrypt
- **部署**: Vercel Serverless / Edge Functions

## 🗂️ 项目结构

```
sublinks/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── admin/        # 管理后台 (日志、用户、源管理)
│   │   ├── dashboard/    # 用户中心 (订阅管理)
│   │   ├── api/          # API 路由 (订阅接口、刷新接口)
│   │   └── ...
│   ├── lib/              # 核心逻辑
│   │   ├── database/     # 数据库适配器 (Postgres/Redis)
│   │   ├── analysis.ts   # 订阅解析与处理核心
│   │   └── ...
└── vercel.json           # Vercel Cron 与部署配置
```

## 🔧 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DATABASE_TYPE` | 数据库类型 (`postgres` 或 `redis`) | ✅ |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | 使用 PG 时 |
| `REDIS_URL` | Redis 连接字符串 | 使用 Redis 时 |
| `JWT_SECRET` | JWT 密钥 | ✅ |
| `NEXT_PUBLIC_SITE_URL` | 站点公网地址 (用于 Vercel Cron callback) | ✅ (Vercel) |
| `LOG_RETENTION_DAYS` | 日志保留天数 | ❌ |
| `MAX_USER_SUBSCRIPTIONS` | 用户最大订阅数 | ❌ |
| `REFRESH_API_KEY` | 刷新接口专用鉴权 Key (可选) | ❌ |

## 📖 新特性说明

### 🛡️ API 日志增强
系统现在提供极详细的 API 访问记录，帮助管理员审计：
- **请求类型**: 区分“订阅获取”、“源刷新”、“状态查询”等。
- **认证方式**: 自动识别 Bearer Token、URL 参数 Key 或 POST Body 中的 Key。
- **Token 验证**: 在日志列表中悬停或点击 Token 可查看完整内容，便于核对。
- **精细分页**: 修复了聚合日志的分页计算问题，浏览大量日志更流畅。

### 📡 上游源管理
- **数据库存储**: 上游源不再依赖 `global_config` JSON，而是存储在独立表中，性能更好且易于管理。
- **流式刷新**: 刷新上游源时支持 Server-Sent Events (SSE) 流式日志，实时看到从下载到解析的每一步。
- **手动/自动触发**: 支持通过 Web 界面手动刷新，或通过 `/api/sources/refresh` 接口触发（支持 Vercel Cron）。

### ⚡ Vercel 优化
- **Serverless 适配**: 针对 Vercel 函数的生命周期优化了异步任务，确保 Cron Job 触发的预缓存任务在函数冻结前完成。
- **超时保护**: 关键接口配置了 `maxDuration`，防止处理大量订阅时超时。

## 🔒 安全建议

1. 首次登录后立即修改默认密码 `admin/admin`。
2. 在 Vercel 环境变量中配置 `REFRESH_API_KEY`，保护刷新接口不被滥用。
3. 生产环境务必使用 HTTPS。

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
