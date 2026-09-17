# 쎄븐 탱고 플레이어 - 로컬 서버
#
# 유튜브는 file:// 로 연 페이지의 영상 재생을 막습니다(오류 153).
# 그래서 이 폴더를 잠깐 http:// 로 띄운 뒤 브라우저를 엽니다.
#
# - 이 PC(localhost) 와 같은 공유기에 연결된 기기(휴대폰)에서만 열립니다.
# - 이 폴더 안의 파일만 읽기 전용으로 내보냅니다. 인터넷에 공개되지 않습니다.
# - 창을 닫으면 서버도 함께 꺼집니다.
param([string]$Root = "$PSScriptRoot\..")

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $Root).Path.TrimEnd('\')

# ---- 포트 열기 ----
$listener = $null
$port = 0
foreach ($p in 8123, 8124, 8125, 8126, 8127, 8231, 8232) {
    try {
        $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $p)
        $l.Start()
        $listener = $l
        $port = $p
        break
    } catch {
        if ($l) { try { $l.Stop() } catch {} }
    }
}

if (-not $listener) {
    Write-Host "  포트를 열 수 없습니다. 8123~8232 를 다른 프로그램이 쓰고 있는지 확인해주세요." -ForegroundColor Red
    Read-Host "  엔터를 누르면 닫힙니다"
    exit 1
}

# ---- 주소 안내 ----
$lan = $null
try {
    $lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
            Sort-Object -Property SkipAsSource |
            Select-Object -First 1).IPAddress
} catch {}

$local = "http://localhost:$port/tango_auto_dj.html"
Write-Host ""
Write-Host "  이 PC에서   : $local" -ForegroundColor Green
if ($lan) {
    Write-Host "  휴대폰에서  : http://${lan}:$port/tango_auto_dj.html" -ForegroundColor Green
    Write-Host "                (같은 와이파이에 연결한 뒤 폰 브라우저 주소창에 입력)"
}
Write-Host ""
Write-Host "  끝내려면 이 창을 닫으세요."
Write-Host ""
Start-Process $local

# ---- 아주 작은 정적 파일 서버 ----
$types = @{
    ".html" = "text/html; charset=utf-8"; ".htm" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8";       ".txt" = "text/plain; charset=utf-8"
    ".png"  = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"; ".svg" = "image/svg+xml";   ".ico" = "image/x-icon"
    ".woff" = "font/woff"; ".woff2" = "font/woff2"
}

function Send-Response($stream, [int]$code, [string]$status, [string]$ctype, [byte[]]$body) {
    $head = "HTTP/1.1 $code $status`r`n" +
            "Content-Type: $ctype`r`n" +
            "Content-Length: $($body.Length)`r`n" +
            "Cache-Control: no-store`r`n" +
            "Connection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($body.Length) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

while ($true) {
    $client = $null
    try {
        $client = $listener.AcceptTcpClient()
        $client.ReceiveTimeout = 5000
        $client.SendTimeout = 15000
        $stream = $client.GetStream()

        # 요청 첫 줄만 읽는다:  GET /경로 HTTP/1.1
        $buf = New-Object byte[] 8192
        $read = $stream.Read($buf, 0, $buf.Length)
        if ($read -le 0) { $client.Close(); continue }
        $req = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read)
        $first = ($req -split "`r`n")[0]
        $parts = $first -split ' '

        if ($parts.Count -lt 2 -or ($parts[0] -ne 'GET' -and $parts[0] -ne 'HEAD')) {
            Send-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("GET만 지원합니다"))
            $client.Close(); continue
        }

        $rel = ($parts[1] -split '\?')[0]
        $rel = [uri]::UnescapeDataString($rel).TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "tango_auto_dj.html" }
        $rel = $rel -replace '/', '\'

        $full = Join-Path $Root $rel
        $resolved = $null
        try { $resolved = (Resolve-Path -LiteralPath $full -ErrorAction Stop).Path } catch {}

        # 이 폴더 밖은 절대 내보내지 않는다
        $okPath = $resolved -and
                  $resolved.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase) -and
                  (Test-Path -LiteralPath $resolved -PathType Leaf)

        if ($okPath) {
            $bytes = [System.IO.File]::ReadAllBytes($resolved)
            $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
            $ctype = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
            if ($parts[0] -eq 'HEAD') { $bytes = New-Object byte[] 0 }
            Send-Response $stream 200 "OK" $ctype $bytes
        } else {
            Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("찾을 수 없습니다"))
        }
    } catch {
        # 브라우저가 연결을 끊는 건 흔한 일이라 조용히 넘어간다
    } finally {
        if ($client) { try { $client.Close() } catch {} }
    }
}
