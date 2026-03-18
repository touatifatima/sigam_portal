#Requires -RunAsAdministrator

param(
  [string]$ServerIp = "10.16.220.140",
  [string]$DomainName = "pom.anam.dz",
  [int]$BackendPort = 3016,
  [int]$FrontendPort = 8080,
  [string]$LogsRoot = "C:\sigam-logs",
  [switch]$EnableTls,
  [string]$TlsCertPath = "C:\certs\pom.anam.dz.fullchain.pem",
  [string]$TlsKeyPath = "C:\certs\pom.anam.dz.key",
  [switch]$DisableHttps443ReverseProxy,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Ensure-Path {
  param([string]$PathToCheck)
  if (-not (Test-Path $PathToCheck)) {
    throw "Missing required path: $PathToCheck"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$serverDir = Join-Path $repoRoot "server"
$clientDir = Join-Path $repoRoot "client"
$clientDist = Join-Path $clientDir "dist"
$nginxDir = "C:\nginx-1.28.0"
$nginxExe = Join-Path $nginxDir "nginx.exe"
$nginxConf = Join-Path $nginxDir "conf\nginx.conf"
$nssm = "C:\nssm-2.24\win64\nssm.exe"
$nodeExe = "C:\Program Files\nodejs\node.exe"
$backendLogsDir = Join-Path $LogsRoot "backend"
$frontendLogsDir = Join-Path $LogsRoot "frontend"
$frontendLogsDirForNginx = $frontendLogsDir -replace "\\", "/"

function Invoke-Nssm {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )
  & $nssm @Arguments | Out-Host
  $exitCode = $LASTEXITCODE
  if (-not $AllowFailure -and $exitCode -ne 0) {
    throw "nssm $($Arguments -join ' ') failed with exit code $exitCode"
  }
}

function Wait-ServiceAbsent {
  param(
    [Parameter(Mandatory = $true)][string]$ServiceName,
    [int]$TimeoutSeconds = 60
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $svc) {
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "Service '$ServiceName' is still present (possibly marked for deletion). Close Services.msc and rerun, or reboot Windows."
}

function Remove-ServiceSafe {
  param([Parameter(Mandatory = $true)][string]$ServiceName)
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  Invoke-Nssm -Arguments @("remove", $ServiceName, "confirm") -AllowFailure
  sc.exe delete $ServiceName | Out-Null
  Wait-ServiceAbsent -ServiceName $ServiceName -TimeoutSeconds 60
}

Ensure-Path $repoRoot
Ensure-Path $serverDir
Ensure-Path $clientDir
Ensure-Path $nginxExe
Ensure-Path $nssm
Ensure-Path $nodeExe

$enableHttps443ReverseProxy = (
  $EnableTls -and
  ($FrontendPort -ne 443) -and
  (-not $DisableHttps443ReverseProxy) -and
  (-not [string]::IsNullOrWhiteSpace($DomainName))
)

$publicFrontendBaseUrl = if ($EnableTls) {
  if ($enableHttps443ReverseProxy -or $FrontendPort -eq 443) {
    "https://$DomainName"
  } elseif (-not [string]::IsNullOrWhiteSpace($DomainName)) {
    "https://${DomainName}:$FrontendPort"
  } else {
    "https://${ServerIp}:$FrontendPort"
  }
} else {
  "http://${ServerIp}:$FrontendPort"
}

$internalFrontendHost = if ($EnableTls -and -not [string]::IsNullOrWhiteSpace($DomainName)) { $DomainName } else { $ServerIp }
$internalFrontendBaseUrl = if ($EnableTls) { "https://${internalFrontendHost}:$FrontendPort" } else { "http://${ServerIp}:$FrontendPort" }
$publicApiBaseUrl = "$publicFrontendBaseUrl/api"

if (-not $SkipBuild) {
  Write-Step "Building backend"
  Push-Location $serverDir
  try {
    npm run build | Out-Host
  } finally {
    Pop-Location
  }

  Write-Step "Building frontend with VITE_API_URL=$publicApiBaseUrl"
  Push-Location $clientDir
  try {
    $env:VITE_API_URL = $publicApiBaseUrl
    $env:NEXT_PUBLIC_API_URL = $publicApiBaseUrl
    npm run build | Out-Host
  } finally {
    Remove-Item Env:\VITE_API_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\NEXT_PUBLIC_API_URL -ErrorAction SilentlyContinue
    Pop-Location
  }
}

Ensure-Path $clientDist

if (-not (Test-Path $backendLogsDir)) { New-Item -Path $backendLogsDir -ItemType Directory | Out-Null }
if (-not (Test-Path $frontendLogsDir)) { New-Item -Path $frontendLogsDir -ItemType Directory | Out-Null }

$listenDirective = [string]$FrontendPort
$tlsDirectives = ""
$tlsCertPathForNginx = ""
$tlsKeyPathForNginx = ""
if ($EnableTls) {
  Ensure-Path $TlsCertPath
  Ensure-Path $TlsKeyPath
  $listenDirective = "$FrontendPort ssl"
  $tlsCertPathForNginx = $TlsCertPath -replace "\\", "/"
  $tlsKeyPathForNginx = $TlsKeyPath -replace "\\", "/"
  $tlsDirectives = @'
        ssl_certificate      __TLS_CERT__;
        ssl_certificate_key  __TLS_KEY__;
        ssl_session_cache    shared:SSL:10m;
        ssl_session_timeout  10m;
        ssl_protocols        TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;
'@
}

$publicHttpsReverseProxyServerBlock = ""
if ($enableHttps443ReverseProxy) {
  $publicHttpsReverseProxyServerBlock = @'
    server {
        listen       443 ssl;
        server_name  __DOMAIN_NAME__;
__TLS_DIRECTIVES__

        location / {
            proxy_pass         https://127.0.0.1:__FRONTEND_PORT__;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection "upgrade";
            proxy_ssl_server_name on;
            proxy_buffering    off;
            proxy_cache        off;
        }
    }
'@
}

$nginxTargetLabel = if ($enableHttps443ReverseProxy) {
  "app port $FrontendPort with public HTTPS on 443"
} else {
  "port $FrontendPort"
}
Write-Step "Writing nginx config for $nginxTargetLabel"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $nginxConf "$nginxConf.bak-$timestamp" -Force

$clientDistForNginx = $clientDist -replace "\\", "/"
$nginxContent = @'
worker_processes  1;
daemon off;

error_log  __FRONTEND_LOG_DIR__/nginx-error.log;
pid        __FRONTEND_LOG_DIR__/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    access_log    __FRONTEND_LOG_DIR__/nginx-access.log;

    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 200m;

    server {
        listen       __LISTEN_DIRECTIVE__;
        server_name  __SERVER_IP__ __DOMAIN_NAME__ localhost;
__TLS_DIRECTIVES__

        root   __CLIENT_DIST__;
        index  index.html;

        location /api/ {
            rewrite            ^/api/(.*)$ /$1 break;
            proxy_pass         http://127.0.0.1:__BACKEND_PORT__;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection "upgrade";
            proxy_buffering    off;
            proxy_cache        off;
        }

        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        }

        location /assets/ {
            try_files $uri =404;
            expires 7d;
            add_header Cache-Control "public, max-age=604800, immutable";
        }

        location / {
            add_header Cache-Control "no-cache";
            try_files $uri $uri/ /index.html;
        }
    }
__PUBLIC_HTTPS_REVERSE_PROXY__
}
'@
$nginxContent = $nginxContent.Replace("__SERVER_IP__", $ServerIp)
$nginxContent = $nginxContent.Replace("__DOMAIN_NAME__", $DomainName)
$nginxContent = $nginxContent.Replace("__CLIENT_DIST__", $clientDistForNginx)
$nginxContent = $nginxContent.Replace("__BACKEND_PORT__", [string]$BackendPort)
$nginxContent = $nginxContent.Replace("__FRONTEND_PORT__", [string]$FrontendPort)
$nginxContent = $nginxContent.Replace("__LISTEN_DIRECTIVE__", $listenDirective)
$nginxContent = $nginxContent.Replace("__TLS_DIRECTIVES__", $tlsDirectives)
$nginxContent = $nginxContent.Replace("__TLS_CERT__", $tlsCertPathForNginx)
$nginxContent = $nginxContent.Replace("__TLS_KEY__", $tlsKeyPathForNginx)
$nginxContent = $nginxContent.Replace("__PUBLIC_HTTPS_REVERSE_PROXY__", $publicHttpsReverseProxyServerBlock)
$nginxContent = $nginxContent.Replace("__FRONTEND_LOG_DIR__", $frontendLogsDirForNginx)
Set-Content -Path $nginxConf -Value $nginxContent -Encoding ascii

Write-Step "Stopping existing SIGAM node/nginx processes"
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*\server\dist\src\main*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Step "Validating nginx config"
& $nginxExe -t -c $nginxConf -p $nginxDir

Write-Step "Installing nssm service: sigam-backend"
Remove-ServiceSafe "sigam-backend"
Invoke-Nssm -Arguments @("install", "sigam-backend", $nodeExe, "dist\src\main")
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppDirectory", $serverDir)
Invoke-Nssm -Arguments @("set", "sigam-backend", "Start", "SERVICE_AUTO_START")
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppStdout", (Join-Path $backendLogsDir "backend-out.log"))
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppStderr", (Join-Path $backendLogsDir "backend-err.log"))
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppRotateFiles", "1")
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppRotateOnline", "1")
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppRotateSeconds", "86400")
Invoke-Nssm -Arguments @("set", "sigam-backend", "AppRotateBytes", "10485760")

Write-Step "Installing nssm service: sigam-nginx"
Remove-ServiceSafe "sigam-nginx"
$nginxParams = "-c $nginxConf -p $nginxDir"
Invoke-Nssm -Arguments @("install", "sigam-nginx", $nginxExe, $nginxParams)
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppDirectory", $nginxDir)
Invoke-Nssm -Arguments @("set", "sigam-nginx", "Start", "SERVICE_AUTO_START")
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppStdout", (Join-Path $frontendLogsDir "nginx-service-out.log"))
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppStderr", (Join-Path $frontendLogsDir "nginx-service-err.log"))
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppRotateFiles", "1")
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppRotateOnline", "1")
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppRotateSeconds", "86400")
Invoke-Nssm -Arguments @("set", "sigam-nginx", "AppRotateBytes", "10485760")

Write-Step "Starting services"
Start-Service sigam-backend
Start-Sleep -Seconds 2
Start-Service sigam-nginx
Start-Sleep -Seconds 2

Write-Step "Validating endpoints"
$rootResp = Invoke-WebRequest -Uri "$publicFrontendBaseUrl/" -UseBasicParsing
$apiResp = Invoke-WebRequest -Uri "$publicFrontendBaseUrl/api/type-permis" -UseBasicParsing
$socketResp = Invoke-WebRequest -Uri "$publicFrontendBaseUrl/api/socket.io/?EIO=4&transport=polling" -UseBasicParsing

Write-Host "`nDeployment complete." -ForegroundColor Green
Write-Host "Public URL       : $publicFrontendBaseUrl"
if ($enableHttps443ReverseProxy) {
  Write-Host "Internal app URL : $internalFrontendBaseUrl"
}
Write-Host "GET / status     : $($rootResp.StatusCode)"
Write-Host "GET /api/*       : $($apiResp.StatusCode)"
Write-Host "GET /api/socket  : $($socketResp.StatusCode)"
Write-Host "Backend logs     : $backendLogsDir"
Write-Host "Frontend logs    : $frontendLogsDir"
