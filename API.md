# SubLinks API 文档

本文档基于实际代码实现，提供 SubLinks 的完整 API 参考。

---

## 📋 目录

- [认证方式](#-认证方式)
- [订阅接口](#-订阅接口)
- [客户端认证](#-客户端认证)
- [客户端数据](#-客户端数据)
- [上游源管理](#-上游源管理)
- [错误响应](#-错误响应)

---

## 🔐 认证方式

SubLinks 使用两种认证机制：

### 1. 订阅 Token（订阅接口）

订阅接口使用订阅专用的 Token，直接在 URL 路径中传递。

### 2. JWT Bearer Token（客户端接口）

客户端 API 使用 JWT 认证，在请求头中传递：

```http
Authorization: Bearer <your_jwt_token>
```

---

## 📡 订阅接口

### 获取订阅配置

获取用户的 Clash 订阅配置文件（YAML 格式）。

**端点**：`GET /api/s/:token`

**参数**：
- `token` (路径参数，必需) - 订阅 Token

**请求示例**：

```bash
curl https://your-domain.com/api/s/abc123def456
```

**成功响应** (200):

```yaml
port: 7890
socks-port: 7891
allow-lan: false
mode: rule
log-level: info

proxies:
  - name: "🇭🇰 香港节点 01"
    type: ss
    server: hk1.example.com
    port: 8388
    cipher: aes-256-gcm
    password: password123

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "🇭🇰 香港节点 01"

rules:
  - DOMAIN-SUFFIX,google.com,🚀 节点选择
  - GEOIP,CN,DIRECT
  - MATCH,🚀 节点选择
```

**响应头**：
- `Content-Type: text/yaml; charset=utf-8`
- `Content-Disposition: attachment; filename="username_token.yaml"`
- `Subscription-Userinfo: upload=0; download=1234567; total=10737418240; expire=1735689600`
- `X-Cache: HIT` 或 `X-Cache: MISS`

**错误响应**：

| 状态码 | 说明 |
|--------|------|
| `400` | 未选择上游源 |
| `403` | Token 无效、订阅已禁用或用户账户被停用 |
| `500` | 服务器配置错误（无上游源）或构建失败 |

**特性**：
- 自动检查上游源新鲜度，过期自动刷新
- 智能缓存机制，提升响应速度
- 支持全局 User-Agent 过滤验证
- 记录访问日志（API Access Log）

---

## � 客户端认证

### 用户登录

客户端用户登录接口，返回 JWT Access Token 和 Refresh Token。

**端点**：`POST /api/client/auth/login`

**请求体**：

```json
{
  "username": "john",
  "password": "password123",
  "deviceInfo": "Samsung S23" 
}
```

**字段说明**：
- `username` - 用户名
- `password` - 密码
- `deviceInfo` - (可选) 设备自定义信息，如型号、版本等。如果不传则默认使用 User-Agent。

**成功响应** (200):

```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john",
    "role": "user",
    "nickname": "John Doe",
    "avatar": "https://your-domain.com/avatars/john.png"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**字段说明**：
- `accessToken` - 访问令牌，用于后续 API 调用
- `refreshToken` - 刷新令牌，用于获取新的 Access Token
- `expiresIn` - Token 有效期（秒），默认 7 天

**错误响应**：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `400` | 用户名和密码不能为空 | 缺少必需字段 |
| `401` | 用户名或密码错误 | 认证失败 |
| `403` | 账户已被停用或封禁 | 用户状态非 active |
| `500` | 服务器内部错误 | 服务器异常 |

### 刷新 Access Token

使用 Refresh Token 获取新的 Access Token。

**端点**：`POST /api/client/auth/refresh`

**请求体**：

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**成功响应** (200):

```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

**错误响应**：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `400` | Refresh token is required | 缺少 refreshToken |
| `401` | Invalid or expired refresh token | Token 无效或已过期 |
| `500` | Internal server error | 服务器异常 |
 
### 用户登出
 
**注意**：客户端在本地清除 Token 的同时，**必须**调用此接口以在服务端吊销 Refresh Token，否则该会话将继续显示在“会话管理”列表中。
 
**端点**：`POST /api/client/auth/logout`
 
**请求体**：
 
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
 
**成功响应** (200):
 
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```
 
**错误响应**：
 
| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `400` | Refresh token is required | 请求体为空或缺少字段 |

---

## 📊 客户端数据

### 获取用户订阅列表

获取当前用户的所有订阅。

**端点**：`GET /api/client/subscriptions`

**认证**：需要 Bearer Token

**请求示例**：

```bash
curl "https://your-domain.com/api/client/subscriptions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**成功响应** (200):

```json
{
  "success": true,
  "subscriptions": [
    {
      "token": "abc123def456",
      "name": "我的主力订阅",
      "url": "https://your-domain.com/api/s/abc123def456",
      "enabled": true,
      "createdAt": 1704067200000
    },
    {
      "token": "xyz789uvw012",
      "name": "备用订阅",
      "url": "https://your-domain.com/api/s/xyz789uvw012",
      "enabled": false,
      "createdAt": 1704153600000
    }
  ]
}
```

**错误响应**：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `401` | Authorization token required | 缺少认证 Token |
| `401` | Invalid or expired token | Token 无效或已过期 |
| `500` | Internal server error | 服务器异常 |

### 获取用户资料

获取当前用户的个人资料和统计信息。

**端点**：`GET /api/client/profile`

**认证**：需要 Bearer Token

**请求示例**：

```bash
curl "https://your-domain.com/api/client/profile" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**成功响应** (200):

```json
{
  "success": true,
  "profile": {
    "id": 1,
    "username": "john",
    "role": "user",
    "subscriptionCount": 3
  }
}
```

**错误响应**：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `401` | Authorization token required | 缺少认证 Token |
| `401` | Invalid or expired token | Token 无效或已过期 |
| `404` | User not found | 用户不存在 |
| `500` | Internal server error | 服务器异常 |

---

## 🔄 上游源管理

### 刷新上游源

触发上游源刷新任务，可选择刷新所有源或指定源。

**端点**：`GET /api/sources/refresh` 或 `POST /api/sources/refresh`

**认证**：需要 API Key（在系统设置中配置 `REFRESH_API_KEY`）

**认证方式**（三选一）：

1. **Bearer Token**（推荐）
   ```bash
   curl -X POST "https://your-domain.com/api/sources/refresh" \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

2. **URL 参数**
   ```bash
   curl "https://your-domain.com/api/sources/refresh?key=YOUR_API_KEY"
   ```

3. **POST Body**
   ```bash
   curl -X POST "https://your-domain.com/api/sources/refresh" \
     -H "Content-Type: application/json" \
     -d '{"key":"YOUR_API_KEY"}'
   ```

**可选参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `sourceName` | string | 刷新单个上游源（URL 参数或 Body） |
| `sourceNames` | string/array | 刷新多个上游源，逗号分隔或数组 |
| `precache` | boolean | 是否预缓存受影响的订阅，默认 false |

**请求示例**：

```bash
# 刷新所有上游源
curl -X POST "https://your-domain.com/api/sources/refresh?key=YOUR_API_KEY"

# 刷新指定上游源
curl -X POST "https://your-domain.com/api/sources/refresh?key=YOUR_API_KEY&sourceName=主力订阅"

# 刷新多个上游源并预缓存
curl -X POST "https://your-domain.com/api/sources/refresh" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceNames": ["主力订阅", "备用订阅"],
    "precache": true
  }'
```

**成功响应** (200):

```json
{
  "success": true,
  "partialSuccess": false,
  "message": "已刷新 3 个上游源",
  "refreshed": ["主力订阅", "备用订阅", "香港专线"],
  "cacheCleared": 15,
  "precached": 0
}
```

**部分成功响应** (200):

```json
{
  "success": true,
  "partialSuccess": true,
  "message": "已刷新 2 个上游源，1 个失败",
  "refreshed": ["主力订阅", "备用订阅"],
  "failed": [
    {
      "name": "香港专线",
      "error": "Connection timeout"
    }
  ],
  "cacheCleared": 10,
  "precached": 5
}
```

**错误响应**：

| 状态码 | 错误信息 | 说明 |
|--------|----------|------|
| `401` | Invalid or missing API key | API Key 错误或缺失 |
| `404` | No valid sources found | 指定的上游源不存在 |
| `404` | No upstream sources configured | 系统未配置任何上游源 |
| `500` | 所有上游源刷新失败 | 全部刷新失败 |
| `503` | Refresh API not configured | 未配置 API Key |

**字段说明**：
- `refreshed` - 成功刷新的上游源名称列表
- `failed` - 刷新失败的上游源及错误信息
- `cacheCleared` - 清除的订阅缓存数量
- `precached` - 预缓存的订阅数量

---

## ❌ 错误响应

所有 API 错误响应遵循统一格式：

```json
{
  "error": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| `200` | 请求成功 |
| `400` | 请求参数错误 |
| `401` | 未授权（Token 无效或缺失） |
| `403` | 禁止访问（权限不足或账户被禁用） |
| `404` | 资源不存在 |
| `500` | 服务器内部错误 |
| `503` | 服务不可用（未配置） |

---

## 📝 使用示例

### Python 示例

```python
import requests

BASE_URL = "https://your-domain.com"

# 1. 用户登录
def login(username, password):
    url = f"{BASE_URL}/api/client/auth/login"
    data = {"username": username, "password": password}
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        result = response.json()
        return result["accessToken"], result["refreshToken"]
    else:
        print(f"登录失败: {response.json()['error']}")
        return None, None

# 2. 获取订阅列表
def get_subscriptions(access_token):
    url = f"{BASE_URL}/api/client/subscriptions"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()["subscriptions"]
    else:
        print(f"获取失败: {response.json()['error']}")
        return []

# 3. 刷新 Token
def refresh_token(refresh_token):
    url = f"{BASE_URL}/api/client/auth/refresh"
    data = {"refreshToken": refresh_token}
    response = requests.post(url, json=data)
    
    if response.status_code == 200:
        return response.json()["accessToken"]
    else:
        print(f"刷新失败: {response.json()['error']}")
        return None

# 4. 刷新上游源（需要管理员 API Key）
def refresh_sources(api_key, source_names=None, precache=False):
    url = f"{BASE_URL}/api/sources/refresh"
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {}
    
    if source_names:
        data["sourceNames"] = source_names
    if precache:
        data["precache"] = True
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()

# 使用示例
access_token, refresh_token = login("john", "password123")
if access_token:
    subscriptions = get_subscriptions(access_token)
    for sub in subscriptions:
        print(f"{sub['name']}: {sub['url']}")
```

### JavaScript 示例

```javascript
const BASE_URL = 'https://your-domain.com';

// 1. 用户登录
async function login(username, password) {
  const response = await fetch(`${BASE_URL}/api/client/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (response.ok) {
    const data = await response.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    };
  } else {
    const error = await response.json();
    console.error('登录失败:', error.error);
    return null;
  }
}

// 2. 获取订阅列表
async function getSubscriptions(accessToken) {
  const response = await fetch(`${BASE_URL}/api/client/subscriptions`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (response.ok) {
    const data = await response.json();
    return data.subscriptions;
  } else {
    const error = await response.json();
    console.error('获取失败:', error.error);
    return [];
  }
}

// 3. 刷新 Token
async function refreshToken(refreshToken) {
  const response = await fetch(`${BASE_URL}/api/client/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (response.ok) {
    const data = await response.json();
    return data.accessToken;
  } else {
    const error = await response.json();
    console.error('刷新失败:', error.error);
    return null;
  }
}

// 4. 刷新上游源
async function refreshSources(apiKey, options = {}) {
  const { sourceNames, precache } = options;
  const body = {};
  
  if (sourceNames) body.sourceNames = sourceNames;
  if (precache) body.precache = true;
  
  const response = await fetch(`${BASE_URL}/api/sources/refresh`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  return await response.json();
}

// 使用示例
(async () => {
  const tokens = await login('john', 'password123');
  if (tokens) {
    const subscriptions = await getSubscriptions(tokens.accessToken);
    subscriptions.forEach(sub => {
      console.log(`${sub.name}: ${sub.url}`);
    });
  }
})();
```

### cURL 示例

```bash
# 1. 用户登录
curl -X POST "https://your-domain.com/api/client/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"password123"}'

# 2. 获取订阅列表
curl "https://your-domain.com/api/client/subscriptions" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 3. 获取用户资料
curl "https://your-domain.com/api/client/profile" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. 刷新 Token
curl -X POST "https://your-domain.com/api/client/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'

# 5. 获取订阅配置
curl "https://your-domain.com/api/s/YOUR_SUBSCRIPTION_TOKEN"

# 6. 刷新所有上游源
curl -X POST "https://your-domain.com/api/sources/refresh?key=YOUR_API_KEY"

# 7. 刷新指定上游源并预缓存
curl -X POST "https://your-domain.com/api/sources/refresh" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceNames": ["主力订阅"],
    "precache": true
  }'
```

---

## 🔒 安全建议

1. **保护 Token** - 不要在公开场合分享订阅 Token 和 JWT Token
2. **使用 HTTPS** - 生产环境必须使用 HTTPS
3. **配置 API Key** - 为刷新接口设置强随机的 `REFRESH_API_KEY`
4. **Token 过期** - Access Token 7 天过期，及时使用 Refresh Token 更新
5. **监控日志** - 定期查看 API 访问日志，发现异常行为
6. **限制权限** - 仅授予必要的 API 访问权限

---

## 📚 相关文档

- [README.md](./README.md) - 项目介绍和快速开始
- [vercel-deployment.md](./vercel-deployment.md) - Vercel 部署指南
- [GitHub Issues](https://github.com/elysiawen/SubLinks/issues) - 问题反馈

---

<div align="center">

**如有疑问，欢迎提交 Issue！**

Made with ❤️ by [ElysiaWen](https://github.com/elysiawen)

</div>
