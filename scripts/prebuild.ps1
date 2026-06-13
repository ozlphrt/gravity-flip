# scripts/prebuild.ps1
# Automatically extract GitHub commit count and inject it into public/version.json and src/main.ts using BOM-free UTF-8

try {
    # 1. Get the current commit count (build number)
    $commitCount = (git rev-list --count HEAD).Trim()
    $commitHash = (git rev-parse --short HEAD).Trim()
    Write-Host "Auto-Versioning: Commit Count is $commitCount ($commitHash)"

    # 2. Write to public/version.json
    $versionJsonPath = Resolve-Path "public/version.json" -ErrorAction SilentlyContinue
    if (!$versionJsonPath) {
        $versionJsonPath = Join-Path (Get-Location) "public/version.json"
    }
    $jsonContent = @{
        version = "1.6.0"
        build = [int]$commitCount
        hash = $commitHash
    } | ConvertTo-Json -Compress

    # Write BOM-Free UTF-8
    [System.IO.File]::WriteAllText($versionJsonPath, $jsonContent, [System.Text.Encoding]::UTF8)
    Write-Host "Auto-Versioning: Updated $versionJsonPath"

    # 3. Update CLIENT_BUILD in src/main.ts
    $mainTsPath = Resolve-Path "src/main.ts" -ErrorAction SilentlyContinue
    if ($mainTsPath -and (Test-Path $mainTsPath)) {
        # Read with UTF-8 to preserve all special characters
        $content = [System.IO.File]::ReadAllText($mainTsPath, [System.Text.Encoding]::UTF8)
        
        # Match "const CLIENT_BUILD = '...';" and replace with current commit hash
        $updatedContent = $content -replace "const CLIENT_BUILD = '.*?';", "const CLIENT_BUILD = '$commitHash';"
        
        # Write back pristine UTF-8 without BOM
        [System.IO.File]::WriteAllText($mainTsPath, $updatedContent, [System.Text.Encoding]::UTF8)
        Write-Host "Auto-Versioning: Injected commit hash $commitHash into $mainTsPath"
    }
}
catch {
    Write-Warning "Auto-Versioning failed: $_"
}
