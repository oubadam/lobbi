# Where Lobbi runs

After you run:

```bash
npm run dev:all
```

- **Website (open this):** **http://localhost:5173**  
  If that port is in use, Vite may use 5174 or 5175 — check the terminal for `Local: http://localhost:XXXX/`.

- **Backend API:** http://localhost:4000  
  The frontend proxies `/api` to this.

- **Clawdbot:** No URL. It runs in the same terminal as `dev:all` and writes to `data/` (trades, state). The website reads that via the backend.

All filters in `config/filters.json` are **enforced** (max age, min/max mcap, min volume, hold times, etc.). The bot reloads filters every cycle.
