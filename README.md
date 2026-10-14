# CineBook — Full-stack movie ticket booking app

A responsive React + Vite frontend and Express backend with persistent JSON storage.

## Features
- Movie discovery and search
- Movie detail pages, show dates, cinemas, and showtimes
- Seat map with unavailable-seat handling and server-side duplicate booking protection
- Registration/login with bcrypt password hashing and JWT sessions
- Personal booking history and booking confirmation IDs
- Seed movie/showtime/cinema data
- Basic admin endpoints for summaries and adding movies

## Requirements
- Node.js 18+ (Node.js 20 LTS recommended)
- npm

## Run locally
1. Extract this ZIP.
2. Open a terminal in the extracted `cinebook-fullstack` folder.
3. Install packages:
   ```bash
   npm install
   ```
4. Start frontend and backend:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173`. API runs on `http://localhost:4000`.

The server creates `server/data.json` automatically on first launch. It stores users, bookings, movie data, cinemas and showtimes. Keep this file private and back it up if needed.

## Production notes
- Set a strong random `JWT_SECRET` environment variable (see `.env.example`).
- Set `CLIENT_ORIGIN` to the deployed frontend origin.
- JSON storage is suitable for a student/demo project only. For production or multiple server instances, move to PostgreSQL/MySQL and use transactions/unique constraints for seat reservations.
- Booking confirmation is simulated; no payment gateway is connected.
- Admin endpoints require a user with `role: "admin"` in `server/data.json`. Do not expose admin access publicly without a proper admin provisioning process.
- Poster images are remote TMDB image URLs; a connection is required for those images to load.

## API overview
- `GET /api/health`
- `GET /api/movies`, `GET /api/movies/:id`
- `GET /api/venues`
- `GET /api/shows?movieId=&date=&venueId=`
- `GET /api/shows/:id/seats`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/bookings`, `POST /api/bookings` (authenticated)
- `GET /api/admin/summary`, `POST /api/admin/movies` (admin role required)

Register body: `{ "name": "Demo User", "email": "demo@example.com", "password": "password123" }`
Booking body: `{ "showId": "show-id", "seats": ["A1", "A2"] }`
