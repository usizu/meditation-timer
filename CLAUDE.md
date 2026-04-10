# Kitty Timer (Mugen)

## Stack
- Frontend: Vanilla TypeScript, SCSS, Vite, PWA + Capacitor (iOS)
- Backend: AdonisJS (in `server/`), SQLite via better-sqlite3

## Migrations
When creating or modifying database migrations in `server/database/migrations/`, always tell the user they need to run the migration before the server will work:
```
cd server && node ace migration:run
```
