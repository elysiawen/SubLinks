# SubLinks

A modern subscription management platform for proxy services. Manage upstream proxy sources, generate per-user subscription links with custom rules and proxy groups, and serve them to Clash/Mihomo-compatible clients.

[中文文档](./README.zh-CN.md)

## Features

- **Upstream Source Management** — Add, edit, and refresh proxy sources via URL or static YAML. Supports automatic caching and traffic stats.
- **Subscription Management** — Create per-user subscription links with source selection, custom proxy groups, and routing rules.
- **Custom Proxy Groups** — Define custom proxy groups with keyword/regex filtering, manual node selection, or source-based grouping.
- **Custom Routing Rules** — Build rule sets with a visual editor (GUI + advanced YAML mode) for domain, IP, and keyword-based routing.
- **Dependency Warnings** — Automatically detect when selected proxy groups/rules reference nodes from unselected upstream sources.
- **User Management** — Admin panel for user CRUD, subscription limits, and per-user configuration.
- **Authentication** — Password login, 2FA (TOTP), Passkey (WebAuthn), and QR code login for client apps.
- **Session Management** — View and revoke active web sessions and client app tokens.
- **UA Filtering** — Blacklist/whitelist user agents at the application level (per-request, configurable rules).
- **Multi-language** — Chinese, English, and Japanese UI with `next-intl`. Cookie-based locale switching.
- **S3 Storage** — Avatar uploads to S3-compatible storage (Cloudflare R2, Tigris, AWS S3, MinIO, or custom).
- **Access Logging** — Tracks API access with IP location, ISP, and user agent parsing.
- **Announcement Banner** — Configurable markdown announcement with color support.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL or MySQL |
| Auth | bcryptjs + jose (JWT) + otplib (TOTP) + SimpleWebAuthn (Passkey) |
| i18n | next-intl 4 |
| Storage | Local filesystem or S3 (via @aws-sdk/client-s3) |
| Image Processing | sharp |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL or MySQL database

### Installation

```bash
git clone https://github.com/your-org/sublinks.git
cd sublinks
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Database (choose one)
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://user:password@host:5432/dbname

# Or MySQL
# DATABASE_TYPE=mysql
# MYSQL_URL=mysql://user:password@host:3306/dbname

# Authentication
ADMIN_PASSWORD=your-admin-password
JWT_SECRET=your-random-secret-string

# Public URL (used for QR codes and client links)
NEXT_PUBLIC_URL=https://your-domain.com
```

### Database Setup

The database tables are created automatically on first run. No manual migration needed.

### Development

```bash
npm run dev
```

The app starts at `http://localhost:3001` (configurable via `-p` flag in `package.json`).

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── admin/              # Admin panel
│   │   ├── groups/         # Proxy group management
│   │   ├── rules/          # Rule set management
│   │   ├── settings/       # System settings (UA filter, storage, etc.)
│   │   ├── sources/        # Upstream source management
│   │   ├── subscriptions/  # Subscription management
│   │   └── users/          # User management
│   ├── api/
│   │   ├── client/         # Client app API (login, subscriptions)
│   │   ├── s/[token]/      # Subscription delivery endpoint
│   │   └── sources/        # Source refresh API
│   ├── dashboard/          # User dashboard
│   │   ├── custom/         # User's custom groups & rules
│   │   ├── sessions/       # Session management
│   │   ├── settings/       # Account settings (profile, 2FA, password)
│   │   └── subscriptions/  # User's subscriptions
│   └── login/              # Login page
├── components/             # Shared React components
├── i18n/                   # i18n configuration and locale definitions
├── lib/
│   ├── database/           # Database abstraction (PostgreSQL, MySQL)
│   ├── analysis.ts         # Upstream source refresh logic
│   ├── auth.ts             # Authentication utilities
│   ├── config-actions.ts   # Shared config CRUD actions
│   ├── group-dependencies.ts # Dependency detection for proxy groups
│   ├── rule-utils.ts       # Rule parsing/serialization utilities
│   ├── storage/            # File storage abstraction (local, S3)
│   ├── ua-filter.ts        # UA filtering logic
│   └── utils.ts            # Shared utilities
└── messages/               # i18n translation files
    ├── zh/                 # Chinese
    ├── en/                 # English
    └── ja/                 # Japanese
```

## API Endpoints

### Subscription Delivery

| Method | Path | Description |
|--------|------|-------------|
| GET/HEAD | `/api/s/:token` | Returns subscription YAML for the given token. Supports `User-Agent`-based format detection. |

### Client App API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/client/auth/login` | Client login (username/password) |
| POST | `/api/client/auth/logout` | Client logout |
| POST | `/api/client/auth/refresh` | Refresh access token |
| GET | `/api/client/auth/user` | Get current user info |
| GET | `/api/client/subscriptions` | List user subscriptions |
| POST | `/api/client/auth/qr/scan` | Generate QR login session |
| POST | `/api/client/auth/qr/confirm` | Confirm QR login |
| POST | `/api/client/auth/qr/reject` | Reject QR login |

## Adding a New Language

1. Create a new folder under `src/messages/` (e.g., `src/messages/ko/`)
2. Copy all JSON files from `src/messages/en/` and translate them
3. Add the locale to `src/i18n/locales.ts`:

```ts
export const LOCALES = [
    { code: 'zh', label: '中文', flag: '🇨🇳', timezone: 'Asia/Shanghai' },
    { code: 'en', label: 'English', flag: '🇺🇸', timezone: 'America/New_York' },
    { code: 'ja', label: '日本語', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
    { code: 'ko', label: '한국어', flag: '🇰🇷', timezone: 'Asia/Seoul' },  // Add this
] as const;
```

## License

Private project. All rights reserved.
