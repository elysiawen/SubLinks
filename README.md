# Vercel Subscription Manager

基于 Next.js 14+ 的 Clash 订阅管理系统,支持多种数据库后端。

## 数据库支持 / Database Support

本项目支持三种数据库后端,可通过环境变量 `DATABASE_TYPE` 选择:

- **Redis** - 推荐用于 Vercel 等无服务器环境 (默认)
- **PostgreSQL** - 适合传统服务器部署,自动创建表结构
- **MySQL** - 适合传统服务器部署,自动创建表结构

## 快速开始 / Quick Start

### 1. 环境配置

创建 `.env.local` 文件(参考 `ENV_CONFIG.md`):

```env
# 选择数据库类型
DATABASE_TYPE=redis  # redis | postgres | mysql

# Redis 配置
REDIS_URL=redis://localhost:6379

# PostgreSQL 配置
POSTGRES_URL=postgresql://user:password@localhost:5432/clash_sub

# MySQL 配置
MYSQL_URL=mysql://user:password@localhost:3306/clash_sub
```

### 2. 安装依赖

```bash
npm install
```

### 3. 运行开发服务器

```bash
npm run dev
```

### 4. 首次登录

访问 `/login`,使用默认账号:
- 用户名: `admin`
- 密码: `admin`

## 部署 / Deployment

### Vercel 部署 (推荐 Redis)

1. 在 Vercel 创建项目
2. 在 Storage 标签页创建 Vercel KV (Redis)
3. 设置环境变量:
   - `DATABASE_TYPE=redis`
   - `REDIS_URL` (自动配置)

### 传统服务器部署 (PostgreSQL/MySQL)

1. 准备 PostgreSQL 或 MySQL 数据库
2. 设置环境变量:
   - `DATABASE_TYPE=postgres` 或 `mysql`
   - `POSTGRES_URL` 或 `MYSQL_URL`
3. 首次运行时会自动创建所需表结构

## 功能特性 / Features

- ✅ **多数据库支持** - Redis / PostgreSQL / MySQL
- ✅ **自动建表** - PostgreSQL 和 MySQL 自动初始化表结构
- ✅ **管理面板** - `/admin` 用户管理、配置管理
- ✅ **订阅管理** - `/dashboard` 用户订阅中心
- ✅ **订阅API** - `/api/s/[token]` Clash 订阅接口
- ✅ **UA 过滤** - 支持客户端白名单
- ✅ **缓存机制** - 24小时默认缓存
- ✅ **自定义规则** - 支持自定义代理组和分流规则

## 技术栈 / Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Redis / PostgreSQL / MySQL
- TailwindCSS

## 文档 / Documentation

详细使用说明请查看 artifacts 中的 `walkthrough.md`。

## License

MIT
