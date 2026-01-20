# SubLinks

<div align="center">

**🚀 强大的订阅链接管理与分发系统**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Felysiawen%2FSubLinks)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

SubLinks 是一个现代化的订阅管理系统，专为 Clash 等代理工具设计。提供灵活的订阅链接管理、多上游源支持、自定义规则和策略组等功能，并完美适配 Vercel Serverless 环境。

[快速开始](#-快速开始) · [功能特性](#-核心功能) · [部署指南](./vercel-deployment.md) · [API 文档](./API.md)

</div>

---

## ✨ 核心功能

### 🎯 订阅管理
- **多上游源聚合** - 支持从多个订阅源合并节点，统一管理
- **自定义规则** - 灵活配置分流规则，支持域名、IP-CIDR、GEOIP 等多种规则类型
- **策略组定制** - 自由组合节点，支持 select、url-test、fallback 等多种策略
- **智能节点过滤** - 支持正则表达式过滤、节点重命名、去重等高级功能

### 🔐 用户系统
- **多用户支持** - 完善的用户/管理员角色体系
- **独立订阅空间** - 每个用户拥有独立的订阅配置和管理界面
- **权限精细控制** - 管理员可管理所有用户和系统配置
- **安全认证** - JWT + bcrypt 加密，保障账户安全

### 📡 上游源管理
- **数据库级管理** - 上游源存储在独立数据表，性能优异
- **Web 界面操作** - 支持在线增删改查，无需修改配置文件
- **流式实时刷新** - Server-Sent Events (SSE) 实时监控刷新进度
- **双重保存选项** - "保存" 和 "保存并更新" 两种操作模式
- **默认源设置** - 支持设置默认上游源，简化用户配置

### 📊 日志审计
- **详细访问记录** - 记录所有 API 访问，包括订阅获取、源刷新等
- **多维度信息** - 显示用户昵称、请求方式、认证类型、IP 地址等
- **Token 验证** - 支持查看完整 Token 内容，便于审计
- **智能分页** - 优化的分页逻辑，流畅浏览大量日志
- **日志聚合** - 自动合并相同用户的连续请求，减少冗余

### 🔍 搜索与过滤
- **全局搜索** - 用户管理、订阅管理支持实时搜索
- **规则搜索** - 分流规则详情支持快速查找
- **策略组搜索** - 支持按名称、类型、代理名搜索策略组
- **实时过滤** - 输入即搜，无需等待

### ⚡ Vercel 优化
- **Edge Proxy 代理** - 利用 Edge Functions 加速订阅源下载
- **Cron 定时任务** - 自动预缓存订阅，提升访问速度
- **Serverless 适配** - 针对 Vercel 函数生命周期优化异步任务
- **超时保护** - 关键接口配置 maxDuration，防止处理超时

### 📱 现代化界面
- **响应式设计** - 完美适配桌面端和移动端
- **直观操作** - 清晰的卡片布局，优化的操作流程
- **实时反馈** - 加载状态、错误提示、成功通知一应俱全
- **暗色模式** - 支持深色主题（规划中）

---

## 🚀 快速开始

### 方式一：Vercel 一键部署（推荐）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Felysiawen%2FSubLinks&env=DATABASE_TYPE,POSTGRES_URL,NEXT_PUBLIC_URL&project-name=sublinks&repository-name=sublinks)

点击上方按钮，按照提示配置环境变量即可完成部署。详见 [Vercel 部署指南](./vercel-deployment.md)。

### 方式二：本地开发

#### 1. 克隆项目

```bash
git clone https://github.com/elysiawen/SubLinks.git
cd SubLinks
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置环境变量

创建 `.env.local` 文件：

```env
# 数据库类型
DATABASE_TYPE=postgres

# PostgreSQL 连接字符串（必需）
POSTGRES_URL=postgresql://user:password@localhost:5432/sublinks

# 站点地址（用于 Cron 预缓存自调用）
NEXT_PUBLIC_URL=http://localhost:3000

# 可选配置
LOG_RETENTION_DAYS=30              # 日志保留天数
MAX_USER_SUBSCRIPTIONS=10          # 用户最大订阅数
REFRESH_API_KEY=your-secret-key    # 刷新接口鉴权密钥
```

#### 4. 启动开发服务器

```bash
npm run dev
```

#### 5. 访问应用

打开浏览器访问 http://localhost:3000

**默认管理员账号**：
- 用户名：`admin`
- 密码：`admin`

> ⚠️ **安全提示**：首次登录后请立即修改默认密码！

---

## 📦 技术栈

| 技术 | 说明 |
|------|------|
| **Next.js 15** | React 框架，使用 App Router |
| **TypeScript** | 类型安全的 JavaScript |
| **Tailwind CSS** | 实用优先的 CSS 框架 |
| **PostgreSQL** | 主数据库（推荐 Neon/Vercel Postgres） |
| **Redis** | 可选的缓存层 |
| **JWT** | 用户认证 |
| **bcrypt** | 密码加密 |
| **Vercel** | Serverless 部署平台 |

---

## 🗂️ 项目结构

```
SubLinks/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/              # 管理后台
│   │   │   ├── logs/           # 日志审计
│   │   │   ├── users/          # 用户管理
│   │   │   ├── sources/        # 上游源管理
│   │   │   ├── rules/          # 分流规则管理
│   │   │   ├── groups/         # 策略组管理
│   │   │   └── settings/       # 系统设置
│   │   ├── dashboard/          # 用户中心
│   │   │   └── subscriptions/  # 订阅管理
│   │   ├── api/                # API 路由
│   │   │   ├── sub/            # 订阅接口
│   │   │   ├── sources/        # 源管理接口
│   │   │   └── cron/           # 定时任务接口
│   │   └── ...
│   ├── lib/                    # 核心逻辑
│   │   ├── database/           # 数据库适配器
│   │   │   ├── postgres.ts     # PostgreSQL 实现
│   │   │   └── redis.ts        # Redis 实现
│   │   ├── analysis.ts         # 订阅解析核心
│   │   ├── subscription-builder.ts  # 配置生成
│   │   ├── storage/            # S3 存储支持
│   │   └── ...
│   └── components/             # React 组件
├── vercel.json                 # Vercel 配置（Cron）
├── README.md                   # 项目说明
├── vercel-deployment.md        # 部署指南
└── API.md                      # API 文档
```

---

## 🔧 环境变量说明

### 必需变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_TYPE` | 数据库类型 | `postgres` 或 `redis` |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | `postgres://user:pass@host:5432/db` |
| `NEXT_PUBLIC_URL` | 站点公网地址（Vercel Cron 必需） | `https://your-app.vercel.app` |

### 可选变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REDIS_URL` | Redis 连接字符串（使用 Redis 时） | - |
| `LOG_RETENTION_DAYS` | 日志保留天数 | `30` |
| `MAX_USER_SUBSCRIPTIONS` | 用户最大订阅数 | `10` |
| `REFRESH_API_KEY` | 刷新接口专用鉴权密钥 | - |
| `S3_ENDPOINT` | S3 兼容存储端点（可选） | - |
| `S3_ACCESS_KEY` | S3 访问密钥 | - |
| `S3_SECRET_KEY` | S3 密钥 | - |

---

## 📖 使用指南

### 管理员操作

1. **添加上游源**
   - 进入 "上游源管理"
   - 点击 "添加上游源"
   - 填写名称、URL、缓存时长等信息
   - 选择 "保存" 或 "保存并更新"

2. **配置分流规则**
   - 进入 "分流规则"
   - 添加自定义规则或从模板导入
   - 支持 DOMAIN、DOMAIN-SUFFIX、IP-CIDR 等类型

3. **管理策略组**
   - 进入 "策略组"
   - 创建 select、url-test、fallback 等策略
   - 配置节点选择和测试参数

4. **查看日志**
   - 进入 "日志审计"
   - 查看 API 访问、Web 访问、系统日志
   - 支持按用户、时间、类型筛选

### 用户操作

1. **创建订阅**
   - 登录用户中心
   - 点击 "添加订阅"
   - 选择上游源、配置规则和策略组
   - 获取订阅链接

2. **管理订阅**
   - 查看订阅详情（节点数、规则数等）
   - 启用/禁用订阅
   - 复制订阅链接
   - 删除订阅

3. **使用订阅**
   - 复制订阅链接
   - 在 Clash 等客户端中导入
   - 享受自定义的代理配置

---

## 🔒 安全建议

1. ✅ **修改默认密码** - 首次登录后立即修改 `admin/admin` 默认密码
2. ✅ **配置 REFRESH_API_KEY** - 保护刷新接口不被滥用
3. ✅ **使用 HTTPS** - 生产环境务必启用 HTTPS
4. ✅ **定期备份数据库** - 定期备份 PostgreSQL 数据
5. ✅ **限制管理员权限** - 仅授予必要的管理员权限
6. ✅ **监控日志** - 定期查看访问日志，发现异常行为

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者！

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by [ElysiaWen](https://github.com/elysiawen)

</div>
