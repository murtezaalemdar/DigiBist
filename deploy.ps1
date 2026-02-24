#!/usr/bin/env pwsh
<#
.SYNOPSIS
    DigiBist Otomatik Deploy Betiği
.DESCRIPTION
    Frontend build + backend deploy + versiyon artırma + GitHub push
    Her deploy'da config.js'deki APP_VERSION_FULL otomatik artırılır.
.USAGE
    .\deploy.ps1                  # Sadece frontend deploy
    .\deploy.ps1 -Backend         # Sadece backend deploy
    .\deploy.ps1 -All             # Frontend + Backend deploy
    .\deploy.ps1 -All -NoBump     # Deploy ama versiyon artırma
    .\deploy.ps1 -All -GitPush    # Deploy + Git commit & push
    .\deploy.ps1 -Major           # Major versiyon artır (v8.05 → v8.06)
#>

param(
    [switch]$Backend,     # Backend deploy
    [switch]$All,         # Frontend + Backend
    [switch]$NoBump,      # Versiyon artırma
    [switch]$GitPush,     # Git commit + push
    [switch]$Major,       # Major versiyon bump (v8.05 → v8.06 vs v8.05.01 → v8.05.02)
    [string]$Message = "" # Git commit mesajı (opsiyonel)
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ProjectRoot "frontend\src\config.js"
$Server = "root@192.168.0.28"

# ─── Renkli çıktı yardımcıları ───
function Write-Step { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "  ✖ $msg" -ForegroundColor Red }

# ─── 1) Versiyon Artırma ───
function Bump-Version {
    $content = Get-Content $ConfigFile -Raw

    # Mevcut versiyonları regex ile bul
    if ($content -match "APP_VERSION = '(v(\d+)\.(\d+))'") {
        $oldAppVer = $Matches[1]
        $verMajor  = [int]$Matches[2]
        $verMinor  = [int]$Matches[3]
    } else {
        Write-Err "APP_VERSION bulunamadı!"; return $null
    }

    if ($content -match "APP_VERSION_FULL = '(v\d+\.\d+\.(\d+))'") {
        $oldFullVer = $Matches[1]
        $verPatch   = [int]$Matches[2]
    } else {
        Write-Err "APP_VERSION_FULL bulunamadı!"; return $null
    }

    if ($Major) {
        $verMinor++
        $verPatch = 0
    } else {
        $verPatch++
    }

    $newAppVer  = "v$verMajor.$("{0:D2}" -f $verMinor)"
    $newFullVer = "v$verMajor.$("{0:D2}" -f $verMinor).$("{0:D2}" -f $verPatch)"

    $content = $content -replace "APP_VERSION = '$oldAppVer'", "APP_VERSION = '$newAppVer'"
    $content = $content -replace "APP_VERSION_FULL = '$oldFullVer'", "APP_VERSION_FULL = '$newFullVer'"

    Set-Content $ConfigFile $content -NoNewline
    Write-Ok "Versiyon: $oldFullVer → $newFullVer"
    return $newFullVer
}

# ─── 2) Frontend Build ───
function Deploy-Frontend {
    Write-Step "Frontend build ediliyor..."
    Push-Location (Join-Path $ProjectRoot "frontend")
    try {
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Err "npm run build başarısız!"; return $false }
        Write-Ok "Build tamamlandı"

        Write-Step "Frontend sunucuya kopyalanıyor..."
        scp -r "build\*" "${Server}:/opt/digibist/frontend/build/" 2>&1 | Out-Null
        Write-Ok "Dosyalar kopyalandı"

        ssh $Server "chmod -R 755 /opt/digibist/frontend/build/" 2>&1 | Out-Null
        Write-Ok "İzinler ayarlandı"
        return $true
    } finally {
        Pop-Location
    }
}

# ─── 3) Backend Deploy ───
function Deploy-Backend {
    Write-Step "Backend sunucuya kopyalanıyor..."
    $backendDir = Join-Path $ProjectRoot "backend"

    scp "$backendDir\main.py" "${Server}:/opt/digibist/backend/main.py" 2>&1 | Out-Null
    Write-Ok "main.py kopyalandı"

    # ML engine ve diğer app dosyaları
    scp -r "$backendDir\app\*" "${Server}:/opt/digibist/backend/app/" 2>&1 | Out-Null
    Write-Ok "app/ klasörü kopyalandı"

    Write-Step "Backend yeniden başlatılıyor..."
    ssh $Server "fuser -k 8000/tcp 2>/dev/null; sleep 2; cd /opt/digibist/backend && /opt/digibist/backend/venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 &" 2>&1 | Out-Null
    Start-Sleep -Seconds 3

    # Sağlık kontrolü
    try {
        $health = ssh $Server "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/stocks/trading-list"
        if ($health -eq "200") {
            Write-Ok "Backend çalışıyor (HTTP 200)"
        } else {
            Write-Warn "Backend yanıt kodu: $health"
        }
    } catch {
        Write-Warn "Sağlık kontrolü atlandı"
    }
    return $true
}

# ─── 4) Git Commit & Push ───
function Git-Push {
    param($version, $commitMsg)
    Write-Step "Git commit & push..."
    Push-Location $ProjectRoot
    try {
        git add -A 2>&1 | Out-Null

        if ([string]::IsNullOrWhiteSpace($commitMsg)) {
            $commitMsg = "$version deploy — $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        } else {
            $commitMsg = "$version $commitMsg"
        }

        git commit -m $commitMsg 2>&1 | Out-Null
        Write-Ok "Commit: $commitMsg"

        git push origin main 2>&1 | Out-Null
        Write-Ok "GitHub push tamamlandı"
    } catch {
        Write-Err "Git hatası: $_"
    } finally {
        Pop-Location
    }
}

# ═══════════════════════════════════════════
# ANA AKIŞ
# ═══════════════════════════════════════════

Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║     DigiBist Deploy Betiği           ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════╝`n" -ForegroundColor Magenta

$newVersion = $null

# Versiyon artır
if (-not $NoBump) {
    Write-Step "Versiyon artırılıyor..."
    $newVersion = Bump-Version
} else {
    # Mevcut versiyonu oku
    $cfgContent = Get-Content $ConfigFile -Raw
    if ($cfgContent -match "APP_VERSION_FULL = '(v[\d.]+)'") {
        $newVersion = $Matches[1]
    }
    Write-Warn "Versiyon artırılmadı (NoBump)"
}

# Deploy
$frontendOk = $false
$backendOk = $false

if ($All -or (-not $Backend)) {
    $frontendOk = Deploy-Frontend
}

if ($All -or $Backend) {
    $backendOk = Deploy-Backend
}

# Git
if ($GitPush) {
    Git-Push -version $newVersion -commitMsg $Message
}

# Sonuç özeti
Write-Host "`n╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║        Deploy Tamamlandı!            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Versiyon  : $newVersion" -ForegroundColor White
if ($frontendOk) { Write-Host "  Frontend  : ✔ Deployed" -ForegroundColor Green } else { Write-Host "  Frontend  : - Atlandı" -ForegroundColor DarkGray }
if ($backendOk)  { Write-Host "  Backend   : ✔ Deployed" -ForegroundColor Green } else { Write-Host "  Backend   : - Atlandı" -ForegroundColor DarkGray }
if ($GitPush)    { Write-Host "  Git Push  : ✔ Pushed" -ForegroundColor Green }  else { Write-Host "  Git Push  : - Atlandı" -ForegroundColor DarkGray }
Write-Host "  Sunucu    : http://192.168.0.28" -ForegroundColor Cyan
Write-Host ""
