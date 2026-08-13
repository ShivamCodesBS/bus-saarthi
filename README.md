# Bus Saarthi

Smart bus management system with real-time GPS tracking, face-recognition attendance, and live CCTV streaming.

## Architecture

| Component | Path | Tech Stack |
|-----------|------|------------|
| **Backend API** | `backend/` | NestJS + TypeORM + PostgreSQL |
| **Frontend** | `frontend/` | React + Vite + TailwindCSS |
| **Admin Panel** | `admin-frontend/` | React + Vite + TailwindCSS |
| **Mobile App** | `mobile/` | Flutter (Android/iOS) |
| **Media Server** | `media-server/` | MediaMTX (RTSP/WebRTC) |
| **Edge Script** | `edge/` | Node.js + FFmpeg |

## Quick Start (Docker)

```bash
# 1. Copy env template and fill in your values
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. Access
# Backend API + Swagger: http://localhost:5000/api/docs
# Frontend:              http://localhost:80
# Admin Panel:           http://localhost:81
```

## Quick Start (Local Dev)

```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend (in another terminal)
cd frontend && npm install && npm run dev

# Admin Frontend (in another terminal)
cd admin-frontend && npm install && npm run dev
```

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

## Mobile App

```bash
cd mobile

# Dev (Android emulator — API defaults to 10.0.2.2:5000)
flutter run

# Production build with custom API URL
flutter build apk --dart-define=API_URL=https://your-api.com --dart-define=HARDWARE_TOKEN=your_secret
```

## License

MIT — see [LICENSE](LICENSE)