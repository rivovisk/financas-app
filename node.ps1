# Brings Node, the program that runs the app, into the app's own folder. Nothing is installed in Windows and no
# administrator is asked. powershell -File node.ps1 <folder>
# Only this exact file of nodejs.org is accepted: its SHA-256 is written here and checked before it is opened.
# Plain letters only: Windows PowerShell 5 reads this file without UTF-8.
param([Parameter(Mandatory = $true)][string]$Folder)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = 'v26.13.1'
$hashes = @{
  'x64'   = 'e2edda75bfb089654705cf65a13b58933bfd5f57148e8ebda916f58a2474f1f7'
  'arm64' = '181ebe431b90787113a9e4fc80d38ce86d37888a353a0386de44d2872e48cb97'
}
$exeHashes = @{
  'x64'   = 'f5109dc868ec38703ad8f305e0aceece717cb60d4889873f434017af4e96cccb'
  'arm64' = '00edc356a01d7fe586beebe7519bb1acdff9dd62064ce4cf12ff1ed4a8d1810e'
}
$from = 'https://nodejs.org/dist'
if ($env:FIN_NODE_FROM) { $from = $env:FIN_NODE_FROM } # tests; the SHA-256 is the same
$temp = $null
try {
  $arch = if (@($env:PROCESSOR_ARCHITECTURE, $env:PROCESSOR_ARCHITEW6432) -contains 'ARM64') { 'arm64' } elseif ([Environment]::Is64BitOperatingSystem) { 'x64' } else { throw 'bits' }
  $exe = Join-Path $Folder 'node.exe'
  if ((Test-Path -LiteralPath $exe -PathType Leaf) -and (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -eq $exeHashes[$arch]) { exit 0 }
  $name = "node-$version-win-$arch"
  $temp = Join-Path ([IO.Path]::GetTempPath()) ('financas-' + [Guid]::NewGuid().ToString('N'))
  $null = New-Item -ItemType Directory -Path $temp
  $zip = Join-Path $temp 'node.zip'
  Write-Host 'Baixando o Node (41 MB). Pode levar alguns minutos.'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  try { Invoke-WebRequest -UseBasicParsing -Uri "$from/$version/$name.zip" -OutFile $zip } catch { throw 'net' }
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $hashes[$arch]) { throw 'hash' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $open = [IO.Compression.ZipFile]::OpenRead($zip)
  try {
    foreach ($f in 'node.exe', 'LICENSE') {
      $entry = $open.GetEntry("$name/$f")
      if (-not $entry) { throw 'zip' }
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $temp $f), $false)
    }
  } finally { $open.Dispose() }
  if ((Get-FileHash -LiteralPath (Join-Path $temp 'node.exe') -Algorithm SHA256).Hash -ne $exeHashes[$arch]) { throw 'hash' }
  $null = New-Item -ItemType Directory -Force -Path $Folder
  Copy-Item -LiteralPath (Join-Path $temp 'LICENSE') -Destination (Join-Path $Folder 'LICENSE') -Force
  Copy-Item -LiteralPath (Join-Path $temp 'node.exe') -Destination $exe -Force
  Write-Host 'Node pronto.'
  $code = 0
} catch {
  $why = switch ("$($_.Exception.Message)") {
    'bits' { 'Este Windows e de 32 bits, e o Node nao funciona nele.' }
    'net' { 'O Node nao baixou. Confira a internet e clique de novo.' }
    'hash' { 'O Node que chegou nao e o original. Nada foi instalado. Clique de novo.' }
    default { 'Nao deu para guardar o Node nesta pasta. Reinicie o computador e clique de novo.' }
  }
  Write-Host $why
  $code = 1
} finally {
  if ($temp -and (Test-Path -LiteralPath $temp)) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
exit $code
