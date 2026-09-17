# Hosting

This site is served by the **owens-sites** service
(`/Users/kevinowens/code/owens-sites`), a single Node server that hosts every
owens property by request host. There is no per-site Render/Netlify/Vercel
config in this repo any more.

## How it is built there

From `owens-sites/hosts/enterpriseaistudio.com.json`:

| Step | Value |
| --- | --- |
| install | *(none — no package.json, nothing to install)* |
| command | *(none — static HTML, nothing to build)* |
| outputDir | `.` (the repo root is published as-is) |

## Where config lives

Aliases (`www.enterpriseaistudio.com` → 301), clean URLs, the 404 page,
redirects, security headers/CSP, cache policy and the allowed form names all
live in `owens-sites/hosts/enterpriseaistudio.com.json`. Host configs are read
once at server boot, so changing that file requires a redeploy of owens-sites.

## Forms

Every form posts same-origin to `POST /api/inquiry` with `form_name`,
`inquiry_type`, `name`, `email`, page-specific fields and a hidden `website`
honeypot. Submissions are stored by owens-sites and read at `/admin`.
Each `form_name` must also be listed in the host config's `forms` map.

## Deploys

Push to `main` triggers `.github/workflows/redeploy.yml`, which pings the
owens-sites Render deploy hook (`RENDER_DEPLOY_HOOK_URL` repo secret).
