# 环境配置示例 / Environment Configuration Example

# ============================================
# 数据库配置 / Database Configuration
# ============================================

# 选择数据库类型 / Choose database type
# 可选值 / Options: redis | postgres | mysql
DATABASE_TYPE=redis

# --------------------------------------------
# Redis 配置 / Redis Configuration
# 当 DATABASE_TYPE=redis 时使用
# Used when DATABASE_TYPE=redis
# --------------------------------------------
REDIS_URL=redis://localhost:6379

# --------------------------------------------
# PostgreSQL 配置 / PostgreSQL Configuration
# 当 DATABASE_TYPE=postgres 时使用
# Used when DATABASE_TYPE=postgres
# --------------------------------------------
# 格式 / Format: postgresql://username:password@host:port/database
POSTGRES_URL=postgresql://user:password@localhost:5432/clash_sub

# --------------------------------------------
# MySQL 配置 / MySQL Configuration
# 当 DATABASE_TYPE=mysql 时使用
# Used when DATABASE_TYPE=mysql
# --------------------------------------------
# 格式 / Format: mysql://username:password@host:port/database
MYSQL_URL=mysql://user:password@localhost:3306/clash_sub

# ============================================
# 应用配置 / Application Configuration
# ============================================

# 管理员默认密码 / Admin default password
# 首次登录使用 admin/admin
# Use admin/admin for first login
ADMIN_PASSWORD=admin

# 应用访问地址 / Application URL
NEXT_PUBLIC_URL=http://localhost:3000

# ============================================
# 使用说明 / Usage Instructions
# ============================================
#
# 1. 复制此文件为 .env.local
#    Copy this file to .env.local
#
# 2. 根据需要选择数据库类型并配置相应的连接URL
#    Choose database type and configure the corresponding connection URL
#
# 3. PostgreSQL 和 MySQL 会自动创建所需的表
#    PostgreSQL and MySQL will automatically create required tables
#
# 4. Redis 适合 Vercel 等无服务器环境
#    Redis is recommended for serverless environments like Vercel
#
# 5. PostgreSQL/MySQL 适合传统服务器部署
#    PostgreSQL/MySQL are suitable for traditional server deployments
#
