param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot ".polazu-runtime"
$processFile = Join-Path $runtimeRoot "processes.json"
$backendLog = Join-Path $runtimeRoot "backend.out.log"
$backendErrorLog = Join-Path $runtimeRoot "backend.err.log"
$frontendLog = Join-Path $runtimeRoot "frontend.out.log"
$frontendErrorLog = Join-Path $runtimeRoot "frontend.err.log"

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$previousProcesses = if (Test-Path -LiteralPath $processFile) {
    Get-Content -Raw -LiteralPath $processFile | ConvertFrom-Json
} else { $null }

function Test-LocalPort([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Find-Java21 {
    $localJava = Get-ChildItem -LiteralPath (Join-Path $runtimeRoot "jdk21-extract") -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "bin\java.exe" } |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -First 1
    if ($localJava) { return $localJava }

    $systemJava = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($systemJava) {
        $version = (& $systemJava.Source -version 2>&1 | Out-String)
        if ($version -match 'version "(2[1-9]|[3-9][0-9])') { return $systemJava.Source }
    }

    $archive = Join-Path $runtimeRoot "jdk21.zip"
    $extractRoot = Join-Path $runtimeRoot "jdk21-extract"
    Write-Host "Java 21을 준비하고 있습니다. 처음 한 번만 시간이 걸립니다."
    curl.exe -L --fail --retry 3 --output $archive "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"
    if ($LASTEXITCODE -ne 0) { throw "Java 21 다운로드에 실패했습니다." }
    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force
    $downloadedJava = Get-ChildItem -LiteralPath $extractRoot -Directory |
        ForEach-Object { Join-Path $_.FullName "bin\java.exe" } |
        Where-Object { Test-Path -LiteralPath $_ } |
        Select-Object -First 1
    if (-not $downloadedJava) { throw "다운로드한 Java 21 실행 파일을 찾지 못했습니다." }
    return $downloadedJava
}

function Wait-ForPort([int]$Port, [string]$Name, [int]$Seconds = 45) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalPort $Port) { return }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name 서버가 제한 시간 안에 시작되지 않았습니다. .polazu-runtime 로그를 확인해 주세요."
}

Set-Location $projectRoot
$javaPath = Find-Java21
$javaHome = Split-Path -Parent (Split-Path -Parent $javaPath)
$env:JAVA_HOME = $javaHome
$env:GRADLE_USER_HOME = Join-Path $runtimeRoot "gradle"

$jarPath = Join-Path $projectRoot "backend\build\libs\backend-0.0.1-SNAPSHOT.jar"
$backendSources = Get-ChildItem -LiteralPath (Join-Path $projectRoot "backend\src") -Recurse -File
$needsBackendBuild = -not (Test-Path -LiteralPath $jarPath)
if (-not $needsBackendBuild) {
    $jarTime = (Get-Item -LiteralPath $jarPath).LastWriteTimeUtc
    $needsBackendBuild = [bool]($backendSources | Where-Object { $_.LastWriteTimeUtc -gt $jarTime } | Select-Object -First 1)
}
if ($needsBackendBuild) {
    Write-Host "백엔드를 빌드하고 있습니다."
    Push-Location (Join-Path $projectRoot "backend")
    try { & .\gradlew.bat bootJar } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "백엔드 빌드에 실패했습니다." }
}

$startedBackend = $null
if (-not (Test-LocalPort 8080)) {
    $docker = Get-Command docker.exe -ErrorAction SilentlyContinue
    $envFile = Join-Path $projectRoot ".env"
    if ($docker -and (Test-Path -LiteralPath $envFile)) {
        & $docker.Source compose up -d mysql
        if ($LASTEXITCODE -ne 0) { throw "Docker MySQL 시작에 실패했습니다." }
        $backendArgs = @("-jar", $jarPath)
        Write-Host "Docker MySQL을 사용합니다."
    } else {
        $h2Path = (Join-Path $runtimeRoot "polazu-dev").Replace("\", "/")
        $backendArgs = @(
            "-jar", $jarPath,
            "--spring.datasource.url=jdbc:h2:file:$h2Path;MODE=MySQL;DATABASE_TO_LOWER=TRUE;AUTO_SERVER=TRUE",
            "--spring.datasource.username=sa",
            "--spring.datasource.password=",
            "--spring.datasource.driver-class-name=org.h2.Driver",
            "--spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
            "--server.address=127.0.0.1",
            "--server.port=8080"
        )
        Write-Host "Docker가 없어 프로젝트 전용 로컬 DB를 사용합니다."
    }
    $startedBackend = Start-Process -FilePath $javaPath -ArgumentList $backendArgs -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog -PassThru
}

$startedFrontend = $null
if (-not (Test-LocalPort 3000)) {
    $npm = Join-Path $projectRoot "npm.cmd"
    $startedFrontend = Start-Process -FilePath $npm -ArgumentList @("run", "dev") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrorLog -PassThru
}

Wait-ForPort 8080 "백엔드"
Wait-ForPort 3000 "프론트엔드"

@{
    backendPid = if ($startedBackend) { $startedBackend.Id } elseif ($previousProcesses) { $previousProcesses.backendPid } else { $null }
    frontendPid = if ($startedFrontend) { $startedFrontend.Id } elseif ($previousProcesses) { $previousProcesses.frontendPid } else { $null }
    startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding UTF8

Write-Host "POLAZU가 실행되었습니다: http://127.0.0.1:3000"
if (-not $NoBrowser) { Start-Process "http://127.0.0.1:3000" }
