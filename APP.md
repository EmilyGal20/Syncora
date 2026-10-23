# Syncora as an app

Development still uses localhost (`npm run frontend` / `npm run backend`).

Clients do not open a browser to localhost. They double-click **`Open-Syncora.cmd`**. A Syncora window opens, with its own local database. There is no Docker, Postgres, Mongo, or hosted server.

## For a client

1. Receive this folder.
2. Double-click `Open-Syncora.cmd`.
3. Sign in. Demo: `admin@syncora.dev` / `ChangeMe123!`

The first open may take a minute if Python needs to set up. After that it just opens a Syncora window. Data stays on that computer under `%LOCALAPPDATA%\Syncora`. There is no Docker, Postgres, Mongo, or hosted server.

Python 3.11+ is the only extra program a client may need. Node.js is only needed if `apps/web/dist` was not included.

## Prepare a folder to share

On your machine, once:

```powershell
npm --prefix apps/web run build
```

Zip the project **without** `.env` (it would point clients at your Postgres). Include `apps/web/dist`.

## Phone (iPhone / Android)

You cannot install `Open-Syncora.cmd` on a phone. The phone opens the same app over Wi-Fi, then you pin it like an app.

1. On the computer, run `Open-Syncora.cmd` and leave it open.
2. Phone and computer must be on the **same Wi-Fi**.
3. On the computer, open `%LOCALAPPDATA%\Syncora\phone-url.txt`. Copy the `On your phone` address (example: `http://192.168.1.23:8765`).
4. Open that address in Safari (iPhone) or Chrome (Android).
5. Install:
   - **iPhone:** Share → **Add to Home Screen**
   - **Android:** menu → **Add to Home screen** / **Install app**

Windows Firewall may ask to allow Python the first time — allow it on private networks.

For **development** on localhost, run `npm run frontend` and `npm run backend`, then on the phone open `http://YOUR-PC-IP:8600`.

## Developers

```powershell
npm run frontend
npm run backend
```

That is the localhost workflow. `npm run app` / `Open-Syncora.cmd` is the client window.
