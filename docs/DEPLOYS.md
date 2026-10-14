# Deploys

What is live, and how to know.

* Open `/version.json` on the site. It holds `commit` (the git commit the pages were built from), `dirty` (true if files differed from that commit), `builtAt` (UTC) and `game`. It holds nothing else.
* A deploy is made with `bun run pages:deploy`: it builds `pages/public` (which writes `version.json`), then uploads it to the Cloudflare Pages project `corporate-snakes-and-ladders`. The Worker's database changes are the numbered files in `apps/edge/migrations`.
* TEST or LIVE mode (whether real payments are taken) is separate from a deploy: `GET /api/mode`.

## Last deploys of `corporate-snakes-and-ladders`

Read from Cloudflare Pages on 2026-10-14 01:24 UTC. Refresh this table with `node tools/list-deploys.mjs` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment).

| Time (UTC) | Environment | Branch | Commit | Result | Deployment |
|---|---|---|---|---|---|
| 2026-10-13 22:31 | production | main | 5e28fd6 | ok | https://fc9e1803.corporate-snakes-and-ladders.pages.dev |
| 2026-10-13 19:40 | production | main | bc6a915 | ok | https://3810bb9f.corporate-snakes-and-ladders.pages.dev |
| 2026-10-13 11:10 | production | main | ae86c2e | ok | https://7317118d.corporate-snakes-and-ladders.pages.dev |
| 2026-10-13 10:51 | production | main | ee2a300 | ok | https://7ed412d8.corporate-snakes-and-ladders.pages.dev |
| 2026-10-13 10:43 | production | main | 674ba0f | ok | https://cef34465.corporate-snakes-and-ladders.pages.dev |
