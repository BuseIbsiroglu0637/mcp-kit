param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]{1,100}$')][string]$ProjectId,[string]$NodePath)
$ErrorActionPreference='Stop'
if (!$NodePath) {$NodePath=(Get-Command node.exe -ErrorAction Stop).Source}
$kitVersion=& $NodePath -p 'process.versions.node'
if ($LASTEXITCODE -ne 0 -or [version]$kitVersion -lt [version]'24.19.0' -or ([version]$kitVersion).Major -ne 24) {throw 'Use Node 24.19.0 or compatible Node 24. Node 25 is outside the tested range.'}
$kitNpm=(Get-Command npm.cmd -ErrorAction Stop).Source
$kitNpmCli=Join-Path (Split-Path $kitNpm) 'node_modules/npm/bin/npm-cli.js'
if (!(Test-Path -LiteralPath $kitNpmCli)) {throw 'npm CLI not found next to npm.cmd. Install standard Node/npm first.'}
Push-Location $PSScriptRoot
try {
 & $NodePath $kitNpmCli ci --ignore-scripts
 if ($LASTEXITCODE -ne 0) {throw 'Dependency installation failed.'}
 & $NodePath (Join-Path $PSScriptRoot 'scripts/init.mjs') $ProjectId
 if ($LASTEXITCODE -ne 0) {throw 'Initialization failed; existing data was not intentionally overwritten.'}
 & $NodePath --test 'test/*.test.mjs'
 if ($LASTEXITCODE -ne 0) {throw 'Tests failed. Connection not accepted.'}
 Write-Output 'Local package installed. Configure your own MCP client next; product connection is not yet verified.'
} finally {Pop-Location}
