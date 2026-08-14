# zxt-next test deployment

This directory is for the isolated test deployment on `171.111.198.77`.

## Scope

- Uses only `/data/zxt-next`.
- Does not modify host Node, host Nginx, or existing applications.
- Exposes admin on `13000`, mobile on `13100`, and API on `14000`.
- Persists SQLite and uploads under `/data/zxt-next/storage`.

## Commands

Run from `/data/zxt-next/deploy`:

```bash
docker compose --env-file env.test -f docker-compose.test.yml build
docker compose --env-file env.test -f docker-compose.test.yml up -d zxt-api zxt-admin zxt-mobile
docker compose --env-file env.test -f docker-compose.test.yml ps
docker compose --env-file env.test -f docker-compose.test.yml logs --tail=100 zxt-api
```

## Notes

- `NEXT_PUBLIC_API_BASE_URL` is baked into the admin build; `NEXT_PUBLIC_MOBILE_API_BASE_URL` is baked into the mobile build.
- AI services are referenced by service names but are not started in this first deployment.
- Do not bind to ports `80` or `443` until Nginx routing is reviewed separately.
