param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$exportRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$exportNames=@('package.json','package-lock.json','.gitignore','README.md','LICENSE','install.ps1','.github/workflows/test.yml','docs/CONNECTIONS.md','examples/claude-desktop.json','examples/evidence.json','scripts/init.mjs','scripts/export.ps1','src/config.mjs','src/protocol.mjs','src/server.mjs','src/store.mjs','test/store.test.mjs','test/transport.test.mjs')
$exportTarget=[IO.Path]::GetFullPath($Destination)
if ([IO.Path]::GetExtension($exportTarget) -ne '.zip' -or (Test-Path -LiteralPath $exportTarget)) {throw 'Choose a new .zip destination; existing files are not overwritten.'}
foreach($exportName in $exportNames) {
 $exportPath=Join-Path $exportRoot $exportName
 if (!(Test-Path -LiteralPath $exportPath -PathType Leaf) -or ((Get-Item -LiteralPath $exportPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Missing or redirected package source.'}
 $exportText=Get-Content -LiteralPath $exportPath -Raw
 if ($exportText -match 'sk-[A-Za-z0-9_-]{20,}|tunnel_[A-Za-z0-9]{12,}|S-1-5-21-[0-9-]+|C:[/\\]Users[/\\][^/\\\s]+[/\\]\.codex') {throw 'Private identifier or credential-shaped content found; export refused.'}
}
New-Item -ItemType Directory -Path (Split-Path $exportTarget) -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression
$exportStream=[IO.File]::Open($exportTarget,[IO.FileMode]::CreateNew)
$exportZip=[IO.Compression.ZipArchive]::new($exportStream,[IO.Compression.ZipArchiveMode]::Create)
try {
 foreach($exportName in $exportNames) {
  $exportEntry=$exportZip.CreateEntry('arkemx-mcp-kit/'+$exportName,[IO.Compression.CompressionLevel]::Optimal)
  $exportInput=[IO.File]::OpenRead((Join-Path $exportRoot $exportName));$exportOutput=$exportEntry.Open()
  try {$exportInput.CopyTo($exportOutput)} finally {$exportInput.Dispose();$exportOutput.Dispose()}
 }
} finally {$exportZip.Dispose();$exportStream.Dispose()}
[pscustomobject]@{Package=$exportTarget; Files=$exportNames.Count; SHA256=(Get-FileHash -LiteralPath $exportTarget -Algorithm SHA256).Hash.ToLowerInvariant(); PrivateRuntimeFilesIncluded=$false} | ConvertTo-Json
