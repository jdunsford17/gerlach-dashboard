# Gerlach EMS Station Board

The station board runs on Node.js 24 with persistent SQLite. The TV view is at `/` and management is at `/manage`.

## First launch

1. Copy `.env.example` to `.env` and restrict its permissions with `chmod 600 .env`.
2. Set `STATION_ORIGIN` to the exact URL the station will use, without a trailing slash. Generate a separate random value for each secret with `openssl rand -hex 32`. Set the admin password and CAD session key at a minimum.
3. Run `docker compose up -d --build`. The app listens on the server at `127.0.0.1:3000`; place your HTTPS reverse proxy in front of it. If your proxy is on a different host, expose the app only to the proxy using your LAN firewall.
4. Open the board and sign in at `/manage` with username `admin` and your configured password. The browser prompts for credentials. Use HTTPS for management over the network.

Without Docker: install Node.js 24, then run `npm ci`, `npm run build`, and `npm start -- --hostname 127.0.0.1` from the repository directory. Use your normal service supervisor to keep it running. Next.js reads `.env`. The default local database is `data/station.sqlite`.

## Migration and integrations

Source alone does not include the live Sites database. A fresh install initializes empty calendar, notes, vehicle configuration and integrations, and statistics. Keep the existing display in use until the new display is verified. To carry over live records, export the Sites database if available and import only the `station_events` and relevant `station_settings` records into an initialized new SQLite database using a transaction while the app is stopped. Exclude `dispatch-session` and `email-import-setup`; reconnect those with new secrets. Keep exports outside Git. For smaller migrations, recreate calendar entries and vehicle settings through the manager and import the latest aggregate report.

- **CAD:** Enter the existing eDispatches screen PIN on the new board after setting `DISPATCH_SESSION_KEY` and `EDISPATCHES_BOARD_GUID` (the GUID in the eDispatches screen URL).
- **Monday:** Point the existing Fleet Readiness and End of Shift Reports subscriptions at the corresponding new URLs: `/api/vehicles/monday?key=<fleet secret>` and `/api/announcements/monday?key=<announcement secret>`. Keep the same board and event filters. To keep both displays running during verification, add subscriptions to the new server before removing the old ones. Replay or import current vehicle/announcement state if needed; webhooks only carry new events. Protect the keys from access logs.
- **ImageTrend:** Set `ELITE_EMAIL_IMPORT_TOKEN`, update the Apps Script with `public/integrations/gerlach-gmail-import.gs`, redeploy its web app, and reconnect it from the statistics manager. The Apps Script and Monday endpoints require an HTTPS address reachable from those services. A LAN-only server needs an inbound route for those endpoints before automatic imports can work.

## Updates and backups

Pull the GitHub repository and rerun `docker compose up -d --build` (or rebuild and restart the Node service). Keep the SQLite data volume. Back up the database with SQLite's backup command or with the service stopped, and back up the environment file separately.
