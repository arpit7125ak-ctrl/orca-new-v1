# ============================================================
# ORCA - Start All Servers
# Run this script from the orca/ root directory
# Usage: .\start-all.ps1
# ============================================================

$root = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ORCA System - Starting All Servers   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Public API Gateway (Port 4000) ---
Write-Host "[1/4] Starting Public API Gateway (Port 4000)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'ORCA | Public API :4000';
  Write-Host '=== PUBLIC API GATEWAY (Port 4000) ===' -ForegroundColor Blue;
  Set-Location '$root\backend';
  npm run dev
"

Start-Sleep -Milliseconds 500

# --- 2. Internal Microservice Gateway (Port 4100) ---
Write-Host "[2/4] Starting Internal Gateway (Port 4100)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'ORCA | Internal Gateway :4100';
  Write-Host '=== INTERNAL MICROSERVICE GATEWAY (Port 4100) ===' -ForegroundColor Yellow;
  Set-Location '$root\backend';
  npm run dev:internal
"

Start-Sleep -Milliseconds 500

# --- 3. Frontend React Client (Port 5173) ---
Write-Host "[3/4] Starting Frontend Client (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'ORCA | Frontend :5173';
  Write-Host '=== FRONTEND REACT CLIENT (Port 5173) ===' -ForegroundColor Green;
  Set-Location '$root\frontend';
  npm run dev
"

Start-Sleep -Milliseconds 500

# --- 4. Python AI Service (Port 8000) ---
Write-Host "[4/4] Starting Python AI Service (Port 8000)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "
  `$host.UI.RawUI.WindowTitle = 'ORCA | AI Service :8000';
  Write-Host '=== PYTHON AI SERVICE (Port 8000) ===' -ForegroundColor Magenta;
  Set-Location '$root\ai-service';
  .\.venv\Scripts\Activate.ps1;
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   All 4 servers launched!              " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Public API   -> http://localhost:4000" -ForegroundColor Blue
Write-Host "  Internal API -> http://localhost:4100" -ForegroundColor Yellow
Write-Host "  Frontend     -> http://localhost:5173" -ForegroundColor Green
Write-Host "  AI Service   -> http://localhost:8000" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Health checks:" -ForegroundColor White
Write-Host "    curl http://localhost:4000/health" -ForegroundColor Gray
Write-Host "    curl http://localhost:4100/health" -ForegroundColor Gray
Write-Host "    curl http://localhost:8000/health" -ForegroundColor Gray
Write-Host ""
