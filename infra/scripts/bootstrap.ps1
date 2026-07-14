param([switch]$SkipDocker)
$ErrorActionPreference = "Stop"
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install
if (-not $SkipDocker) { docker compose up -d postgres mariadb wordpress }
pnpm db:generate
pnpm db:migrate
pnpm db:seed
Write-Host "Prêt. Lancez pnpm dev puis ouvrez http://localhost:3000"
