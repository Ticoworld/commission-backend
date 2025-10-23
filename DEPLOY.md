Deployment checklist (staging -> production)

Prerequisites
- Ensure environment variables are set on the target host or in your deployment system:
  - DATABASE_URL
  - JWT_SECRET
  - UPLOAD_DIR (path where uploads are stored)
  - EMAIL_FROM, SMTP_HOST, SMTP_USER, SMTP_PASS (if email features are required)
  - PORT (optional; default 5000)
  - FRONTEND_ORIGIN (for CORS configuration)

High-level deploy steps
1. Install dependencies
   - Use "npm ci" on CI/production for reproducible installs.

2. Generate Prisma client
   - "npm run generate" (runs prisma generate) — required after schema changes.

3. Apply database migrations
   - Production: "npm run migrate" (runs prisma migrate deploy) to apply pending migrations.
   - Run migrations in staging first and validate before production.

4. Build (not required for this backend)
   - This project is a Node/Express app. No separate build step is required for the server.

5. Start or restart the application
   - Example (systemd/PM2/container): start the Node process and ensure environment variables are injected.
   - For development: "npm run dev".

6. Post-deploy smoke tests
   - Run the included health-check script (see below) to verify endpoints and authenticated flows:
     - node scripts/health-check.js --apiBase http://localhost:5000 --token <JWT>

7. Verify uploads storage
   - Ensure UPLOAD_DIR is a persistent, backed storage (PVC, S3, or network disk). Do not rely on container ephemeral disk for production.

8. Secure production
   - Run behind HTTPS (reverse proxy / load balancer with TLS).
   - Lock down CORS to your frontend origin.
   - Ensure JWT_SECRET and other secrets are strong and rotated when needed.

Quick smoke tests (PowerShell)
  Health endpoint:
    Invoke-RestMethod 'http://localhost:5000/api/health'

  Authenticated checks (replace <TOKEN> with a valid JWT):
    $headers = @{ Authorization = "Bearer <TOKEN>" }
    Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/me' -Headers $headers
    Invoke-RestMethod -Uri 'http://localhost:5000/api/uploads/all' -Headers $headers

  Download protected file to disk (replace filename and token):
    Invoke-WebRequest -Uri 'http://localhost:5000/api/uploads/<filename>' -Headers $headers -OutFile 'downloaded-file'

If you'd like, I can extend this checklist into a full CI job (GitHub Actions / Azure DevOps) that runs migrations and the health-check script automatically.
