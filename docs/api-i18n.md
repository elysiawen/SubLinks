# API i18n - Client Integration Guide

SubLinks API returns error/success messages in the client's preferred language via the `Accept-Language` HTTP header.

## How it works

The server parses the `Accept-Language` header and returns messages in the matching language. If the language is not supported or the header is missing, **English** is used as the default fallback.

## Supported Languages

| Code | Language |
|------|----------|
| `zh` | Chinese |
| `en` | English (default fallback) |

More languages can be added on the server side in the future.

## Request Header

Add `Accept-Language` to your HTTP requests:

```
Accept-Language: zh
```

or

```
Accept-Language: en
```

The parser reads the first language tag before the comma (e.g., `zh-CN` → `zh`, `en-US` → `en`).

## Affected Endpoints

All error and success messages in the following endpoints are translated. The `error`/`message` values change based on `Accept-Language`.

### 1. Subscription API

**`GET /api/s/{token}`**

| Status | zh | en |
|--------|----|----|
| 503 | 所选订阅源均已被禁用或不可用 | All selected upstream sources are disabled or unavailable |

### 2. Client Login API

**`POST /api/client/auth/login`**

| Status | zh | en |
|--------|----|----|
| 400 | 用户名和密码不能为空 | Username and password are required |
| 401 | 用户名或密码错误 | Invalid username or password |
| 403 | 账户已被停用或封禁 | Account has been disabled or suspended |
| 401 | 两步验证码错误或已过期 | Invalid or expired two-factor authentication code |
| 500 | 服务器内部错误 | Internal server error |

2FA required (status 200):
```json
{ "requires2FA": true, "message": "该账户已启用两步验证，请提供 TOTP 验证码" }
```

### 3. User Info API

**`GET /api/client/auth/user`**

| Status | zh | en |
|--------|----|----|
| 401 | 未提供认证令牌 | Authentication token not provided |
| 401 | 无效或过期的令牌 | Invalid or expired token |
| 500 | 服务器内部错误 | Internal server error |

### 4. Token Refresh API

**`POST /api/client/auth/refresh`**

| Status | zh | en |
|--------|----|----|
| 400 | 缺少 Refresh Token | Refresh token is required |
| 401 | 无效或过期的 Refresh Token | Invalid or expired refresh token |
| 401 | 会话已被撤销或过期 | Session revoked or expired |
| 500 | 服务器内部错误 | Internal server error |

### 5. Logout API

**`POST /api/client/auth/logout`**

| Status | zh | en |
|--------|----|----|
| 400 | 缺少 Refresh Token | Refresh token is required |
| 500 | 服务器内部错误 | Internal server error |

Success (status 200):
```json
{ "success": true, "message": "已成功退出登录" }
```

### 6. QR Scan API

**`POST /api/client/auth/qr/scan`**

| Status | zh | en |
|--------|----|----|
| 400 | 缺少 QR Token | QR token is required |
| 400 | QR Token 已过期 | QR token expired |
| 400 | 无效的 QR Token 状态 | Invalid QR token status |
| 404 | 无效或过期的 QR Token | Invalid or expired QR token |
| 500 | 服务器内部错误 | Internal server error |

### 7. QR Confirm API

**`POST /api/client/auth/qr/confirm`**

| Status | zh | en |
|--------|----|----|
| 400 | 缺少 QR Token | QR token is required |
| 400 | QR Token 已过期 | QR token expired |
| 400 | 无效的 QR Token 状态 | Invalid QR token status |
| 401 | 未授权 | Unauthorized |
| 401 | 无效或过期的令牌 | Invalid or expired token |
| 401 | 设备会话已被撤销，请重新登录 | Device session has been revoked. Please re-login. |
| 401 | 会话已被撤销或过期 | Session revoked or expired |
| 404 | 无效或过期的 QR Token | Invalid or expired QR token |
| 500 | 服务器内部错误 | Internal server error |

Success messages:
```json
{ "success": true, "message": "已确认" }          // Already confirmed
{ "success": true, "message": "登录已确认" }        // Login confirmed
```

### 8. QR Reject API

**`POST /api/client/auth/qr/reject`**

| Status | zh | en |
|--------|----|----|
| 400 | 缺少 QR Token | QR token is required |
| 400 | QR Token 已过期 | QR token expired |
| 400 | 已确认 | Already confirmed |
| 401 | 未授权 | Unauthorized |
| 401 | 无效或过期的令牌 | Invalid or expired token |
| 404 | 无效或过期的 QR Token | Invalid or expired QR token |
| 500 | 服务器内部错误 | Internal server error |

Success message:
```json
{ "success": true, "message": "登录已拒绝" }
```

### 9. Subscriptions List API

**`GET /api/client/subscriptions`**

| Status | zh | en |
|--------|----|----|
| 401 | 未提供认证令牌 | Authentication token not provided |
| 401 | 无效或过期的令牌 | Invalid or expired token |
| 500 | 服务器内部错误 | Internal server error |

## Example: ClashMetaForAndroid (OkHttp Interceptor)

```kotlin
val localeInterceptor = Interceptor { chain ->
    val request = chain.request().newBuilder()
        .header("Accept-Language", Locale.getDefault().language)
        .build()
    chain.proceed(request)
}

val client = OkHttpClient.Builder()
    .addInterceptor(localeInterceptor)
    .build()
```

## Example: clash-verge-rev

In the request headers configuration or code:

```
Accept-Language: zh
```

or dynamically based on the system locale.

## Adding New Languages

1. Create `src/messages/{lang}/api.json` with translated strings
2. Add the language code to the `locales` array in `src/lib/api-i18n.ts`
3. Done - clients sending `Accept-Language: {lang}` will receive responses in that language
