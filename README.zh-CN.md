# SubLinks

现代化的代理订阅管理平台。管理上游代理源，为每个用户生成带有自定义规则和策略组的订阅链接，兼容 Clash/Mihomo 客户端。

[English](./README.md)

## 功能特性

- **上游源管理** — 通过 URL 或静态 YAML 添加、编辑、刷新代理源，支持自动缓存和流量统计。
- **订阅管理** — 为每个用户创建订阅链接，支持源选择、自定义策略组和分流规则。
- **自定义策略组** — 支持关键词/正则过滤、手动选节点、按源分组等方式定义策略组。
- **自定义分流规则** — 可视化规则编辑器（GUI + 高级 YAML 模式），支持域名、IP、关键词路由。
- **依赖警告** — 自动检测所选策略组/规则是否引用了未勾选的上游源节点。
- **用户管理** — 管理面板支持用户增删改查、订阅数量限制、用户级配置。
- **身份认证** — 密码登录、两步验证 (TOTP)、Passkey (WebAuthn)、客户端扫码登录。
- **会话管理** — 查看和撤销活跃的 Web 会话和客户端应用令牌。
- **UA 过滤** — 应用层 User-Agent 黑名单/白名单过滤，支持多种匹配规则。
- **多语言** — 中文、英文、日文界面，基于 `next-intl`，通过 Cookie 切换语言。
- **S3 存储** — 头像上传到 S3 兼容存储（Cloudflare R2、Tigris、AWS S3、MinIO 或自定义）。
- **访问日志** — 记录 API 访问，包含 IP 归属地、运营商和 User-Agent 解析。
- **公告栏** — 可配置的 Markdown 公告，支持彩色文字。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, React 19) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 数据库 | PostgreSQL 或 MySQL |
| 认证 | bcryptjs + jose (JWT) + otplib (TOTP) + SimpleWebAuthn (Passkey) |
| 国际化 | next-intl 4 |
| 存储 | 本地文件系统或 S3 (@aws-sdk/client-s3) |
| 图片处理 | sharp |

## 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 或 MySQL 数据库

### 安装

```bash
git clone https://github.com/your-org/sublinks.git
cd sublinks
npm install
```

### 环境变量

创建 `.env.local` 文件：

```env
# 数据库（二选一）
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@host:5432/dbname

# 或 MySQL
# DATABASE_TYPE=mysql
# MYSQL_URL=mysql://user:password@host:3306/dbname

# 认证
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-random-secret-string

# 公网地址（用于二维码和客户端链接）
NEXT_PUBLIC_URL=https://your-domain.com

# 数据统计（可选，仅生产环境启用）
# CLARITY_ID=your-clarity-id
# UMAMI_WEBSITE_ID=your-umami-website-id
# UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js  # 不填则默认使用 Umami Cloud
# GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 数据库初始化

首次运行时自动建表，无需手动迁移。

### 开发模式

```bash
npm run dev
```

应用启动在 `http://localhost:3001`（可通过 `package.json` 中的 `-p` 参数修改）。

### 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── app/
│   ├── admin/              # 管理后台
│   │   ├── groups/         # 策略组管理
│   │   ├── rules/          # 分流规则管理
│   │   ├── settings/       # 系统设置（UA 过滤、存储等）
│   │   ├── sources/        # 上游源管理
│   │   ├── subscriptions/  # 订阅管理
│   │   └── users/          # 用户管理
│   ├── api/
│   │   ├── client/         # 客户端 API（登录、订阅）
│   │   ├── s/[token]/      # 订阅投递端点
│   │   └── sources/        # 源刷新 API
│   ├── dashboard/          # 用户仪表盘
│   │   ├── custom/         # 用户自定义策略组和规则
│   │   ├── sessions/       # 会话管理
│   │   ├── settings/       # 账户设置（资料、两步验证、密码）
│   │   └── subscriptions/  # 用户订阅
│   └── login/              # 登录页
├── components/             # 共享 React 组件
├── i18n/                   # i18n 配置和语言定义
├── lib/
│   ├── database/           # 数据库抽象层（PostgreSQL、MySQL）
│   ├── analysis.ts         # 上游源刷新逻辑
│   ├── auth.ts             # 认证工具
│   ├── config-actions.ts   # 共享配置 CRUD
│   ├── group-dependencies.ts # 策略组依赖检测
│   ├── rule-utils.ts       # 规则解析/序列化工具
│   ├── storage/            # 文件存储抽象（本地、S3）
│   ├── ua-filter.ts        # UA 过滤逻辑
│   └── utils.ts            # 共享工具函数
└── messages/               # i18n 翻译文件
    ├── zh/                 # 中文
    ├── en/                 # 英文
    └── ja/                 # 日文
```

## API 端点

### 订阅投递

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/HEAD | `/api/s/:token` | 返回指定 token 的订阅 YAML，支持根据 User-Agent 自动检测格式 |

### 客户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/client/auth/login` | 客户端登录（用户名/密码） |
| POST | `/api/client/auth/logout` | 客户端登出 |
| POST | `/api/client/auth/refresh` | 刷新访问令牌 |
| GET | `/api/client/auth/user` | 获取当前用户信息 |
| GET | `/api/client/subscriptions` | 获取用户订阅列表 |
| POST | `/api/client/auth/qr/scan` | 生成扫码登录会话 |
| POST | `/api/client/auth/qr/confirm` | 确认扫码登录 |
| POST | `/api/client/auth/qr/reject` | 拒绝扫码登录 |

## 添加新语言

1. 在 `src/messages/` 下创建新文件夹（如 `src/messages/ko/`）
2. 复制 `src/messages/en/` 中的所有 JSON 文件并翻译
3. 在 `src/i18n/locales.ts` 中添加语言：

```ts
export const LOCALES = [
    { code: 'zh', label: '中文', flag: '🇨🇳', timezone: 'Asia/Shanghai' },
    { code: 'en', label: 'English', flag: '🇺🇸', timezone: 'America/New_York' },
    { code: 'ja', label: '日本語', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
    { code: 'ko', label: '한국어', flag: '🇰🇷', timezone: 'Asia/Seoul' },  // 添加这行
] as const;
```

## 许可证

私有项目，保留所有权利。
