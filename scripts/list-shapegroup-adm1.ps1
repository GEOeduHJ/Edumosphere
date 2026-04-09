<#
Scan the local ADM1 composite for features whose `shapeGroup` is "-99".
Writes a count and prints the first matching lines for inspection.
Usage: run from repository root with PowerShell.
#>
$path = "public/data/geoBoundaries/ADM1.geojson"
if (-not (Test-Path $path)) {
  Write-Host "File not found: $path"
  exit 2
}
Write-Host "Scanning $path for 'shapeGroup: -99'..."
$pattern = '"shapeGroup"\s*:\s*"-?99"'
try {
  $matches = Select-String -Path $path -Pattern $pattern -Encoding UTF8 -AllMatches
} catch {
  Write-Host "Error scanning file: $_"
  exit 3
}
$count = ($matches | Measure-Object).Count
Write-Host "Matches for shapeGroup -99: $count"
if ($count -gt 0) {
  Write-Host "First 20 matching lines:"
  $matches | Select-Object -First 20 | ForEach-Object { Write-Host $_.Line }
}
Write-Host "Done."
