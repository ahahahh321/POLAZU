$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot ".polazu-runtime"
$processFile = Join-Path $runtimeRoot "processes.json"

if (Test-Path -LiteralPath $processFile) {
    $saved = Get-Content -Raw -LiteralPath $processFile | ConvertFrom-Json
    foreach ($processId in @($saved.backendPid, $saved.frontendPid)) {
        if ($processId) {
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) { taskkill.exe /PID $processId /T /F | Out-Null }
        }
    }
    Remove-Item -LiteralPath $processFile -Force
}

$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
if ($docker -and (Test-Path -LiteralPath (Join-Path $projectRoot ".env"))) {
    Push-Location $projectRoot
    try { & $docker.Source compose stop } finally { Pop-Location }
}

Write-Host "POLAZU 로컬 서버를 종료했습니다."
