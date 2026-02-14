# VEX Scout Proxy (Cloudflare Worker)

This proxy keeps your RobotEvents API token on the server side and exposes one endpoint for the scouting frontend.

## 1) Install and login

```bash
cd /Users/nicksonc/Desktop/VexProjects/NicksonC1.github.io/proxy
npm i -D wrangler
npx wrangler login
```

## 2) Add your RobotEvents token as a secret

```bash
npx wrangler secret put ROBOTEVENTS_TOKEN
```

Paste your token when prompted.

## 3) Configure allowed origins

Edit `wrangler.toml` and set `ALLOWED_ORIGINS`.

Example:

```toml
[vars]
ALLOWED_ORIGINS = "https://nicksonc1.github.io"
```

For multiple origins, use comma-separated values.

## 4) Deploy

```bash
npx wrangler deploy
```

Worker URL will look like:

`https://vex-scout-proxy.<subdomain>.workers.dev`

## 5) Connect frontend

Edit `/Users/nicksonc/Desktop/VexProjects/NicksonC1.github.io/js/scout-config.js`:

```js
window.SCOUT_CONFIG.proxyBaseUrl = "https://vex-scout-proxy.<subdomain>.workers.dev";
```

Now `/scouting.html` and `/skills.html` will call the proxy.

`/scouting.html`:

`GET <proxyBaseUrl>/api/scout?team=169A&program=1&season=190`

`/skills.html`:

`GET <proxyBaseUrl>/api/skills?program=1&season=190&page=1&per_page=50`

## API routes

- `GET /api/health`
- `GET /api/scout?team=<TEAM>&program=<PROGRAM_ID>&season=<SEASON_ID>`
- `GET /api/skills?program=<PROGRAM_ID>&season=<SEASON_ID>&page=<N>&per_page=<N>`
- `GET /api/seasons?program=<PROGRAM_ID>`

`program` and `season` are optional.

## Security notes

- Never hardcode RobotEvents tokens in HTML/JS.
- If a token was pasted into source at any point, revoke it and issue a new one.
- Keep `ALLOWED_ORIGINS` strict in production.
