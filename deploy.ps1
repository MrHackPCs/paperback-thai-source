# Automated Build, Test, and Deploy script for Paperback Extensions

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Paperback Repository Deployment (5 Sources)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 1: Build
Write-Host "`n[1/4] Building sources..." -ForegroundColor Yellow
node build.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Build failed!" -ForegroundColor Red
    exit 1
}

# Step 2: Simulation Test
Write-Host "`n[2/4] Running sandboxed simulation tests..." -ForegroundColor Yellow
node test_simulation.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "[-] Simulation tests failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Package public/ into gh-pages commit
Write-Host "`n[3/4] Preparing gh-pages branch commit..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "Update sources build output"
}

$tree = (git write-tree --prefix=public/).Trim()
$parent = (git rev-parse gh-pages 2>$null)
if (-not $parent) {
    $parent = (git rev-parse remotes/origin/gh-pages 2>$null)
}

if ($parent) {
    $commit = (git commit-tree $tree -p $parent -m "Deploy to gh-pages [skip ci]").Trim()
} else {
    $commit = (git commit-tree $tree -m "Deploy to gh-pages [skip ci]").Trim()
}

git update-ref refs/heads/gh-pages $commit
Write-Host "[+] gh-pages commit created: $commit" -ForegroundColor Green

# Step 4: Push to GitHub
Write-Host "`n[4/4] Pushing main and gh-pages to GitHub..." -ForegroundColor Yellow
git push origin main
git push origin gh-pages

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
    Write-Host "  Repository URL : https://github.com/MrHackPCs/paperback-thai-source" -ForegroundColor Cyan
    Write-Host "  GitHub Pages   : https://mrhackpcs.github.io/paperback-thai-source/" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Green
} else {
    Write-Host "`n[!] Push requires authentication. Please log in or provide your GitHub PAT." -ForegroundColor Yellow
}
