# Called It

A no-betting NBA prediction league. Fans rank both conferences, pick the awards, vote Bucket or Brick on league calls, post bold calls, and climb the leaderboard all season.

Everything runs on Netlify: the page is static, three Netlify Functions save and serve picks, Netlify Blobs stores them, and Netlify Identity emails each player a sign-in link.

## Deploy

1. Put these files in a GitHub repo.
2. In Netlify, choose Add new project, then Import an existing project, and pick the repo. The settings come from `netlify.toml`, so just deploy.
3. In Project configuration, open Environment variables and add `ADMIN_EMAILS` with your email (comma separate more than one). Redeploy.
4. In Project configuration, open Identity and enable it. Leave registration open. Under Emails, set the Confirmation template to `/emails/confirmation.html` and the Recovery template to `/emails/recovery.html`.
5. Open the site and sign in with the email from step 3. The Commish tab appears.

## How it works

| Path | What it does |
| --- | --- |
| `public/index.html` | The whole site |
| `netlify/functions/state.mjs` | `GET /api/state` returns the league and everyone's picks, hiding picks that haven't locked |
| `netlify/functions/entry.mjs` | `PUT /api/entry` saves the signed-in player's picks and refuses changes after a lock |
| `netlify/functions/admin.mjs` | `POST /api/admin` commissioner tools, limited to `ADMIN_EMAILS` |
| `netlify/lib/seed.json` | Starting questions, award candidates and league calls, used until you edit them |
| `public/emails/*.html` | Sign-in email templates |

Sign-in uses Identity's confirmation email for new players and its recovery email for returning ones. Both just sign the person in, so nobody ever needs a password.
