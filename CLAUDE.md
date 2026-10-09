# Air Defence Duel — working rules

Turn-based 1v1 missile duel between two cities. iOS first; Android after iOS is final.
Owner: Mert (non-technical — explain in plain words, give click-by-click steps for accounts).

## Process
- Discuss first: present the plan/figures and wait. Only start coding when Mert explicitly says go.
- One item at a time. Never change anything beyond the agreed item; mention other things, don't fix them.
- After each item: build/check, commit (one commit per item), `git push`.
- Mert does account sign-ups/logins/payments (Apple Developer, Google Play, hosting) when asked.

## Services
- GitHub: github.com/mmertsimsek53/AIR-DEFENCE-DUEL (private).
- Neon: project `airdefenceduel` (young-grass-99096952), Frankfurt, org-divine-bonus-39424766. Branches `live` (default) and `dev` (work here). Connection strings in `server/.env` (gitignored): `DATABASE_URL` = dev, `LIVE_DATABASE_URL` = live. Neon CLI: `npx -y neonctl@2` with Node from `~/.airlineroom-tools/node/bin`.
- Firebase (Auth only): project `Air Defence Duel` — being set up.

## Layout
- `prototype/air-defence-duel.html` — original browser prototype (three.js r128, single file, pass-and-play). Reference only.
- `docs/GAME_DESIGN.md` — the agreed rules. Update it whenever a rule is decided.
