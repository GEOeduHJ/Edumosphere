<#
Copy `public/data/world-countries.geojson` to
`public/data/geoBoundaries/ADM0.geojson`, add to Git (tracked by LFS),
and push to origin.
#>
$src = 'public/data/world-countries.geojson'
$dst = 'public/data/geoBoundaries/ADM0.geojson'
if (-not (Test-Path $src)) { Write-Host "Source missing: $src"; exit 2 }
if (-not (Test-Path (Split-Path $dst -Parent))) { New-Item -ItemType Directory -Path (Split-Path $dst -Parent) | Out-Null }
Copy-Item -Force $src $dst
try { git lfs track $dst } catch { Write-Host "git lfs track may have failed: $_" }
git add .gitattributes $dst
try {
  git commit -m "Add ADM0 composite (ADM0.geojson) copied from world-countries.geojson"
  if ($LASTEXITCODE -eq 0) { git push origin main }
} catch {
  Write-Host "No commit/push created: $_"
}
