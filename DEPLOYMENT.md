# Zahrah — Production Deployment (AWS)

Target: **ECS Fargate** (API + storefront + admin) · **RDS Postgres** · **ElastiCache Redis** · **S3 + CloudFront** for media · domain **zahrahfashion.com** (GoDaddy).

```
Route 53 / GoDaddy DNS
  zahrahfashion.com        → ALB → storefront service (Fargate)
  admin.zahrahfashion.com  → ALB → admin service (Fargate)
  (both) /api/*            → API service (internal)         cdn.zahrahfashion.com → CloudFront → S3 (media)
                                   │
                          RDS Postgres · ElastiCache Redis
```

Three container images live in the repo: `apps/api/Dockerfile`, `apps/storefront/Dockerfile`, `apps/admin/Dockerfile` (build from the **repo root**). All config is via env — see `.env.production.example`.

---

## 0a. Push to GitHub
The repo is already git-initialised (`main`). Create an **empty private repo** on GitHub (no README), then:
```bash
cd ZahrahFashion
git remote add origin git@github.com:<you>/zahrah.git   # or https://github.com/<you>/zahrah.git
git add -A
git commit -m "Production-ready: S3 media, Redis auth state, Docker/AWS deploy, blank store"
git branch -M main
git push -u origin main
```
Confirm `.gitignore` covers `node_modules`, `.next*`, `dist`, `uploads`, and **all `.env*` files** (it does) so secrets never land in the repo. From here, CI (GitHub Actions) or your machine builds the images in step 3.

## 0. Prerequisites
- AWS account, `aws` CLI configured, an ECR repo per app, a VPC with public + private subnets.
- `zahrahfashion.com` in GoDaddy. Decide: keep DNS at GoDaddy, **or** delegate to Route 53 (recommended — simpler ACM + ALB alias records).

## 1. Media — S3 + CloudFront
1. **S3 bucket** `zahrah-media` (Block Public Access ON — it stays private).
2. **CloudFront** distribution, origin = the bucket via **Origin Access Control (OAC)**; attach the generated bucket policy.
3. Alternate domain `cdn.zahrahfashion.com` + an **ACM cert in us-east-1** (CloudFront requires us-east-1).
4. **CORS** on the bucket (so the MIM design canvas can read images cross-origin):
   ```json
   [{"AllowedOrigins":["https://zahrahfashion.com"],"AllowedMethods":["GET"],"AllowedHeaders":["*"],"MaxAgeSeconds":3000}]
   ```
5. App env: `S3_MEDIA_BUCKET=zahrah-media`, `AWS_REGION=…`, `MEDIA_PUBLIC_URL=https://cdn.zahrahfashion.com`.
   The API writes originals + WebP renditions to `s3://zahrah-media/media/…` and stores CDN URLs. No AWS keys in the app — the **ECS task role** gets `s3:PutObject` on the bucket.

## 2. Data stores
- **RDS Postgres 16** (private subnet, `sslmode=require`). Put the connection string in `DATABASE_URL` (Secrets Manager).
- **ElastiCache Redis** (private) → `REDIS_URL`. (Reserved for moving OTP/session state off in-process memory when you scale the API past 1 task — see “Scaling” below.)
- Security groups: API task SG → RDS:5432 and Redis:6379.

## 3. Build & push images (per app)
```bash
# from repo root; repeat for storefront and admin
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build -f apps/api/Dockerfile -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/zahrah-api:latest .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/zahrah-api:latest
# storefront needs NEXT_PUBLIC_* at build time:
docker build -f apps/storefront/Dockerfile --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=$GID -t …/zahrah-storefront:latest .
```

## 4. ECS Fargate + ALB
Create an ECS cluster and **3 services**:

| Service | Image | Container port | Env |
|---|---|---|---|
| `zahrah-api` | zahrah-api | 4000 | all API vars from `.env.production.example` (NODE_ENV, DATABASE_URL, PAYSTACK_*, RESEND_*, S3_*, TRACKING_SECRET, ADMIN_URL, STOREFRONT_URL) |
| `zahrah-storefront` | zahrah-storefront | 3000 | `API_URL` = internal API URL |
| `zahrah-admin` | zahrah-admin | 3000 | `API_URL` = internal API URL |

- **API is internal** (private) — the frontends reach it via **Service Connect / Cloud Map** (e.g. `http://zahrah-api.internal:4000`) set in `API_URL`. Do **not** expose the API publicly; the frontends proxy `/api/*` to it.
- **Public ALB** with HTTPS (ACM cert for `zahrahfashion.com` + `admin.zahrahfashion.com`), two host-based rules:
  - `zahrahfashion.com` → storefront target group (:3000)
  - `admin.zahrahfashion.com` → admin target group (:3000)
- Health check path `/` for both frontends.
- Put `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `TRACKING_SECRET` in **Secrets Manager** and reference them in the task definition (not plaintext env).
- Task role: `s3:PutObject`/`s3:GetObject` on `arn:aws:s3:::zahrah-media/*`.

The API container runs `prisma migrate deploy` on start, then boots. (Prefer a one-off migrate task if you run multiple API replicas.)

## 5. Seed the blank store
Run once against RDS (a one-off ECS task or locally through a bastion):
```bash
npm run -w @zahrah/api seed        # SEED_DEMO NOT set → blank store: roles, owner, settings, zones, units
```
This creates the **owner/Manager** account. **Immediately** change its password after first login (seed default is known). To reset an already-populated DB to blank later: `npx tsx apps/api/prisma/clean-state.ts`.

## 6. DNS (GoDaddy → AWS)
**Recommended — delegate to Route 53:** create a hosted zone for `zahrahfashion.com`, copy its 4 NS records into GoDaddy (Nameservers → Custom). Then in Route 53:
- `zahrahfashion.com` → **Alias A** → the public ALB
- `admin.zahrahfashion.com` → **Alias A** → the ALB
- `cdn.zahrahfashion.com` → **Alias A** → the CloudFront distribution
- ACM DNS-validation CNAMEs for the certs

**Or keep DNS at GoDaddy:** point `@`, `admin`, and `cdn` as CNAME/A records at the ALB/CloudFront domains (GoDaddy can't alias the apex cleanly — Route 53 is smoother for the root domain).

## 7. Go-live checklist
- [ ] `NODE_ENV=production` on all services (turns off dev fallbacks / on-screen codes).
- [ ] **Resend: verify `zahrahfashion.com`** as a sending domain (DNS records) — without it, login/OTP/invite emails never arrive.
- [ ] Owner login email (`zahrah@zahrahfashion.com`) is a real, monitored inbox.
- [ ] Paystack **LIVE** secret key set + admin **Settings → gateway mode = live**.
- [ ] `TRACKING_SECRET` is a strong random value.
- [ ] `API_URL` on both frontends resolves to the internal API.
- [ ] Media: upload an image in admin → confirm it lands in S3 and serves via `cdn.zahrahfashion.com`.
- [ ] Change the owner password; add your real staff.
- [ ] Add real products.

## Scaling
OTP / pending-auth state is stored in **Redis** (`EphemeralStore`) when `REDIS_URL` is set — so you can **run multiple API tasks** safely (a code issued by one task is verified by any other). Step-up state already lives in the DB (session row). Without `REDIS_URL` it falls back to in-process memory (single-instance dev only), so **set `REDIS_URL` in production**.
