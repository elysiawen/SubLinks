# SubLinks

**强大的订阅链接管理与分发系统**

SubLinks 是一个现代化的订阅管理系统，专为 Clash 等代理工具设计，提供灵活的订阅链接管理、多上游源支持、自定义规则和策略组等功能。

## ✨ 主要特性

- 🔐 **用户管理** - 多用户支持，角色权限控制
- 📡 **上游源管理** - 支持多个上游订阅源，可设置默认源
- 📝 **订阅管理** - 为每个用户创建和管理多个订阅
- 🎨 **自定义配置** - 自定义策略组和分流规则
- 📊 **数据分析** - 查看节点、策略组、规则等详细信息
- 📜 **日志审计** - 完整的访问日志和系统日志
- 🔄 **智能缓存** - 自动缓存失效和刷新机制
- 🎯 **灵活刷新** - 支持定时刷新和手动刷新

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
POSTGRES_URL=postgresql://user:password@localhost:5432/sublinks
JWT_SECRET=your-random-secret-key
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

## 📦 技术栈

- **框架**: Next.js 16
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **数据库**: PostgreSQL / Redis
- **认证**: JWT + bcrypt
- **部署**: Vercel

## 🗂️ 项目结构

```
sublinks/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── admin/        # 管理后台
│   │   ├── dashboard/    # 用户中心
│   │   ├── login/        # 登录页面
│   │   └── api/          # API 路由
│   ├── lib/              # 核心逻辑
│   │   ├── database/     # 数据库适配器
│   │   ├── actions.ts    # Server Actions
│   │   └── analysis.ts   # 订阅解析
│   └── components/       # React 组件
├── public/               # 静态资源
└── vercel.json          # Vercel 配置
```

## 🔧 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DATABASE_TYPE` | 数据库类型 (`postgres` 或 `redis`) | ✅ |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | 使用 PG 时 |
| `REDIS_URL` | Redis 连接字符串 | 使用 Redis 时 |
| `JWT_SECRET` | JWT 密钥 | ✅ |
| `LOG_RETENTION_DAYS` | 日志保留天数 | ❌ |
| `MAX_USER_SUBSCRIPTIONS` | 用户最大订阅数 | ❌ |

## 📖 功能说明

### 管理后台

- **概览** - 系统统计和快捷操作
- **用户管理** - 创建、编辑、删除用户
- **订阅管理** - 管理所有用户的订阅
- **上游源管理** - 配置和刷新上游订阅源
- **内容分析** - 查看节点、策略组、规则
- **日志审计** - 访问日志和系统日志

### 用户中心

- **订阅管理** - 创建和配置个人订阅
- **自定义规则** - 添加自定义分流规则
- **修改密码** - 更改账户密码

## 🔒 安全建议

1. 首次登录后立即修改默认密码
2. 使用强密码策略
3. 定期备份数据库
4. 不要在代码中硬编码敏感信息
5. 使用 HTTPS（Vercel 自动提供）

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请提交 Issue 或查看文档。
