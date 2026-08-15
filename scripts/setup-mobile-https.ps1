$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $repoRoot ".certs"
$mobilePublicDir = Join-Path $repoRoot "apps/mobile/public"
$rootCertPath = Join-Path $certDir "zxt-local-root-ca.cer"
$serverPfxPath = Join-Path $certDir "zxt-mobile-lan.pfx"
$apiEnvPath = Join-Path $repoRoot "apps/api/.env"
$apiEnvExamplePath = Join-Path $repoRoot "apps/api/.env.example"

$lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|WSL|Hyper-V|Loopback"
  } |
  Select-Object -First 1 -ExpandProperty IPAddress
if (-not $lanIp) {
  throw "No LAN IPv4 address was found. Connect to Wi-Fi or Ethernet first."
}

New-Item -ItemType Directory -Force -Path $certDir, $mobilePublicDir | Out-Null
$now = [DateTimeOffset]::UtcNow

$rootKey = [System.Security.Cryptography.RSA]::Create(4096)
$rootReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=ZXT Local Development Root", $rootKey, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$rootReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
$rootKeyUsage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign
$rootReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($rootKeyUsage, $true))
$rootReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootReq.PublicKey, $false))
$rootCert = $rootReq.CreateSelfSigned($now.AddDays(-1), $now.AddYears(5))

$serverKey = [System.Security.Cryptography.RSA]::Create(2048)
$serverReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$lanIp", $serverKey, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$serverReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
$serverKeyUsage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
$serverReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($serverKeyUsage, $true))
$eku = [System.Security.Cryptography.OidCollection]::new()
[void]$eku.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1"))
$serverReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $false))
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddIpAddress([System.Net.IPAddress]::Parse($lanIp))
$serverReq.CertificateExtensions.Add($san.Build())
$serverReq.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($serverReq.PublicKey, $false))
$serial = New-Object byte[] 16
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($serial)
$random.Dispose()
$leaf = $serverReq.Create($rootCert, $now.AddDays(-1), $now.AddYears(2), $serial)
$serverCert = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($leaf, $serverKey)

[IO.File]::WriteAllBytes($rootCertPath, $rootCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
[IO.File]::WriteAllBytes($serverPfxPath, $serverCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx))
Copy-Item -LiteralPath $rootCertPath -Destination (Join-Path $mobilePublicDir "zxt-local-root-ca.cer") -Force

if (-not (Test-Path $apiEnvPath)) {
  Copy-Item -LiteralPath $apiEnvExamplePath -Destination $apiEnvPath
}
$envLines = @(Get-Content -LiteralPath $apiEnvPath | Where-Object { $_ -notmatch "^API_CORS_ORIGINS=" })
$envLines += "API_CORS_ORIGINS=http://$lanIp`:3100,https://$lanIp`:3443"
Set-Content -LiteralPath $apiEnvPath -Value $envLines -Encoding utf8

Write-Output "HTTPS setup complete."
Write-Output "Mobile URL: https://$lanIp`:3443"
Write-Output "Root certificate: http://$lanIp`:3100/zxt-local-root-ca.cer"
Write-Output "Restart local services, then run npm run start:mobile:https."
