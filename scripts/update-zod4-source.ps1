
#Requires -Version 7.0

$ErrorActionPreference = "Stop"

# --------------------------------------------------
# 1. Project paths
# --------------------------------------------------

$ProjectRoot = (Get-Location).Path
$RelativePath = "apps/mcp-server/src/index.ts"
$TargetFile = Join-Path $ProjectRoot $RelativePath

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    throw "Project root not found. Run this script from Virtualbox-mcp-server."
}

if (-not (Test-Path $TargetFile)) {
    throw "Target TypeScript file not found: $TargetFile"
}

# --------------------------------------------------
# 2. Verify Zod 4 installation
# --------------------------------------------------

$ZodPackage = Join-Path $ProjectRoot "node_modules/zod/package.json"

if (-not (Test-Path $ZodPackage)) {
    throw "Zod is not installed at the workspace root. Check npm ls zod."
}

$ZodVersion = (Get-Content $ZodPackage -Raw | ConvertFrom-Json).version

if ([version]$ZodVersion -lt [version]"4.6.7") {
    throw "Zod 4.6.7 or newer is required. Current version: $ZodVersion. No files were modified."
}

Write-Host "Zod version: $ZodVersion" -ForegroundColor Green

# --------------------------------------------------
# 3. Read source
# --------------------------------------------------

$Content = [System.IO.File]::ReadAllText(
    $TargetFile,
    [System.Text.Encoding]::UTF8
)

# --------------------------------------------------
# 4. Define exact replacements
# --------------------------------------------------

$Replacements = @(

    # Limit supported runtime installations
    @{
        Name = "Limit runtimes"
        Old  = 'runtimes: z.array(z.string())'
        New  = 'runtimes: z.array(z.string()).max(4)'
    }

    # Limit development tools installation
    @{
        Name = "Limit development tools"
        Old  = 'tools: z.array(z.string())'
        New  = 'tools: z.array(z.string()).max(20)'
    }

    # Zod 4 record syntax - configure_shell
    @{
        Name = "Fix configure_shell record schema"
        Old  = 'secrets: z.record(z.string()).optional()'
        New  = 'secrets: z.record(z.string(), z.string()).optional()'
    }

    # Limit synchronization exclusion patterns
    @{
        Name = "Limit sync exclusion patterns"
        Old  = 'exclude_patterns: z.array(z.string()).optional()'
        New  = 'exclude_patterns: z.array(z.string()).max(100).optional()'
    }

    # Limit cleanup_zombies input
    @{
        Name = "Limit cleanup VM names"
        Old  = 'const { vm_names, dry_run } = z.object({ vm_names: z.array(z.string()), dry_run: z.boolean().default(true) }).parse(args);'
        New  = 'const { vm_names, dry_run } = z.object({ vm_names: z.array(z.string()).min(1).max(100), dry_run: z.boolean().default(true) }).parse(args);'
    }

    # Zod 4 record syntax - inject_secrets
    @{
        Name = "Fix inject_secrets record schema"
        Old  = 'secrets: z.record(z.string()),'
        New  = 'secrets: z.record(z.string(), z.string()),'
    }
)

# --------------------------------------------------
# 5. Validate every original snippet
#    Nothing is changed if validation fails.
# --------------------------------------------------

foreach ($Rule in $Replacements) {

    $Count = [regex]::Matches(
        $Content,
        [regex]::Escape($Rule.Old)
    ).Count

    if ($Count -ne 1) {
        throw "Validation failed: '$($Rule.Name)' expected exactly 1 match, found $Count. No files were modified."
    }

    Write-Host "[VALID] $($Rule.Name)" -ForegroundColor Green
}

# --------------------------------------------------
# 6. Apply replacements in memory
# --------------------------------------------------

$UpdatedContent = $Content

foreach ($Rule in $Replacements) {

    $UpdatedContent = $UpdatedContent.Replace(
        $Rule.Old,
        $Rule.New
    )
}

if ($UpdatedContent -eq $Content) {
    throw "No changes generated. Aborting."
}

# --------------------------------------------------
# 7. Create backup outside the repository
# --------------------------------------------------

$BackupDirectory = Join-Path `
    (Split-Path $ProjectRoot -Parent) `
    "Virtualbox-mcp-server-zod-backup"

New-Item -ItemType Directory -Force -Path $BackupDirectory |
    Out-Null

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupFile = Join-Path `
    $BackupDirectory `
    "mcp-index.ts.stage4-$Timestamp.bak"

Copy-Item -LiteralPath $TargetFile -Destination $BackupFile

Write-Host "`nBackup created:" -ForegroundColor Cyan
Write-Host $BackupFile

# --------------------------------------------------
# 8. Write modified source
# --------------------------------------------------

$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

[System.IO.File]::WriteAllText(
    $TargetFile,
    $UpdatedContent,
    $Utf8NoBom
)

# --------------------------------------------------
# 9. Final checks
# --------------------------------------------------

$FinalContent = [System.IO.File]::ReadAllText(
    $TargetFile,
    [System.Text.Encoding]::UTF8
)

$RemainingOldRecords = [regex]::Matches(
    $FinalContent,
    'z\.record\(z\.string\(\)\)'
).Count

if ($RemainingOldRecords -ne 0) {
    Copy-Item -LiteralPath $BackupFile -Destination $TargetFile -Force
    throw "Old Zod record syntax remains. Original file restored."
}

Write-Host "`nAll modifications completed successfully." -ForegroundColor Green

foreach ($Rule in $Replacements) {
    Write-Host "[UPDATED] $($Rule.Name)" -ForegroundColor Green
}

Write-Host "`nChecking Git diff..." -ForegroundColor Cyan

git diff --check -- $RelativePath
git diff -- $RelativePath
