param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:43818'
function Test-GameServer {
    try { return (Invoke-RestMethod -Uri "$gameUrl/health" -TimeoutSec 2).app -eq 'mecha-arena-multiplayer' } catch { return $false }
}
try {
    if (-not (Test-GameServer)) {
        $gameNode = Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1
        if (-not $gameNode) {
            $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
            if (Test-Path -LiteralPath $bundledNode) { $gameNode = $bundledNode }
        }
        if (-not $gameNode) { throw 'Node.js nao encontrado. Instale Node.js ou abra este projeto no Codex para executar o jogo.' }
        $runtimeDirectory = Join-Path $gameRoot '.runtime'
        New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
        $gameServerPath = Join-Path $gameRoot 'server.mjs'
        $gameProcess = Start-Process -FilePath $gameNode -ArgumentList ('"' + $gameServerPath + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log') -PassThru
        $gameProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'server.pid')
        for ($attempt = 0; $attempt -lt 10; $attempt++) {
            if (Test-GameServer) { break }
            Start-Sleep -Milliseconds 300
        }
        if (-not (Test-GameServer)) { throw 'Nao foi possivel iniciar o Mecha Arena. Consulte .runtime\server-error.log.' }
    }
    if (-not $NoBrowser) { Start-Process $gameUrl }
    Write-Output "Mecha Arena pronto: $gameUrl"
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    exit 1
}
