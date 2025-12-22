# 内存数据库配置

## 开发环境使用内存数据库

在 `.env.local` 文件中添加以下配置:

```bash
# 启用内存数据库 (推荐用于本地开发)
USE_MEMORY_DB=true
```

### 优势
- ✅ 数据在重启后自动清空
- ✅ 无需手动清理数据库
- ✅ 完全兼容PostgreSQL语法
- ✅ 不需要外部数据库服务

### 切换到真实数据库

如需使用真实PostgreSQL数据库,只需注释或删除该配置:

```bash
# USE_MEMORY_DB=true  # 注释掉这行

# 然后配置真实数据库
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@localhost:5432/dbname
```

## 配置说明

### 内存模式 (开发)
```bash
USE_MEMORY_DB=true
```

### PostgreSQL模式 (生产)
```bash
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@localhost:5432/dbname
```

### MySQL模式
```bash
DATABASE_TYPE=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=dbname
```

### Redis模式
```bash
DATABASE_TYPE=redis
REDIS_URL=redis://localhost:6379
```
