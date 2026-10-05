# ============================================================
# RESUME ORGANIZER
# ============================================================
#
# Searches ALL folders and subfolders.
#
# Resume files:
#   PDF / DOC / DOCX / RTF
#       -> YEAR -> MONTH
#
# Other files:
#       -> DO_IT_YOURSELF
#
# Exact duplicate files:
#       -> DO_IT_YOURSELF\DUPLICATES
#
# Duplicate filenames are renamed:
#       Resume.pdf
#       Resume_1.pdf
#       Resume_2.pdf
#
# A CSV report is created.
#
# IMPORTANT:
# Start with $DryRun = $true
# ============================================================


# ============================================================
# 1. CHANGE THIS TO YOUR MAIN RESUME FOLDER
# ============================================================

$SourceFolder = "D:\All Resumes"


# ============================================================
# 2. SAFETY MODE
#
# $true  = TEST ONLY. Nothing moves.
# $false = ACTUALLY MOVE FILES.
# ============================================================

$DryRun = $true


# ============================================================
# 3. FILE TYPES CONSIDERED RESUMES
# ============================================================

$ResumeExtensions = @(
    ".pdf",
    ".doc",
    ".docx",
    ".rtf"
)


# ============================================================
# 4. SPECIAL FOLDERS
# ============================================================

$DoItYourselfFolder = Join-Path `
    $SourceFolder `
    "DO_IT_YOURSELF"

$DuplicateFolder = Join-Path `
    $DoItYourselfFolder `
    "DUPLICATES"


# ============================================================
# 5. REPORT FILE
# ============================================================

$ReportPath = Join-Path `
    $SourceFolder `
    "Resume_Sorting_Report.csv"


# ============================================================
# 6. Make sure source folder exists
# ============================================================

if (!(Test-Path -LiteralPath $SourceFolder)) {

    Write-Host ""
    Write-Host "ERROR: Source folder does not exist!" `
        -ForegroundColor Red

    Write-Host $SourceFolder

    exit
}


# ============================================================
# 7. Get all files from every subfolder
# ============================================================

Write-Host ""
Write-Host "Scanning folders..." `
    -ForegroundColor Cyan

$Files = Get-ChildItem `
    -LiteralPath $SourceFolder `
    -File `
    -Recurse


Write-Host ""
Write-Host "Files found: $($Files.Count)" `
    -ForegroundColor Cyan


# ============================================================
# 8. Create array for report
# ============================================================

$Report = @()


# ============================================================
# 9. Hash table for duplicate detection
# ============================================================

$Hashes = @{}

$ProcessedCount = 0


# ============================================================
# 10. Process every file
# ============================================================

foreach ($File in $Files) {

    $ProcessedCount++

    Write-Progress `
        -Activity "Processing files" `
        -Status "$ProcessedCount of $($Files.Count): $($File.Name)" `
        -PercentComplete (($ProcessedCount / $Files.Count) * 100)


    # --------------------------------------------------------
    # Ignore the CSV report if it already exists
    # --------------------------------------------------------

    if ($File.FullName -eq $ReportPath) {
        continue
    }


    # --------------------------------------------------------
    # Ignore files inside our generated folders
    # --------------------------------------------------------

    if ($File.FullName.StartsWith(
        $DoItYourselfFolder + "\",
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        continue
    }


    # --------------------------------------------------------
    # Get creation date
    # --------------------------------------------------------

    $CreationDate = $File.CreationTime

    $Year = $CreationDate.ToString("yyyy")

    $Month = $CreationDate.ToString("MMMM")


    # --------------------------------------------------------
    # Determine file extension
    # --------------------------------------------------------

    $Extension = $File.Extension.ToLower()


    # ========================================================
    # CASE 1:
    # Supported resume format
    # ========================================================

    if ($ResumeExtensions -contains $Extension) {

        # ----------------------------------------------------
        # Calculate SHA-256 hash
        # ----------------------------------------------------

        try {

            $Hash = (Get-FileHash `
                -LiteralPath $File.FullName `
                -Algorithm SHA256).Hash

        }
        catch {

            $Report += [PSCustomObject]@{

                FileName = $File.Name

                OriginalPath = $File.FullName

                CreationDate = $CreationDate

                Destination = ""

                Status = "ERROR - Could not calculate hash"
            }

            continue
        }


        # ----------------------------------------------------
        # Check whether this exact file appeared before
        # ----------------------------------------------------

        if ($Hashes.ContainsKey($Hash)) {

            $DestinationFolder = $DuplicateFolder

            $Status = "EXACT DUPLICATE"


            # Destination filename
            $DestinationPath = Join-Path `
                $DestinationFolder `
                $File.Name


            # ------------------------------------------------
            # Handle duplicate filename
            # ------------------------------------------------

            if (Test-Path -LiteralPath $DestinationPath) {

                $Name = [System.IO.Path]::GetFileNameWithoutExtension(
                    $File.Name
                )

                $Ext = $File.Extension

                $Counter = 1


                do {

                    $NewName = "${Name}_${Counter}${Ext}"

                    $DestinationPath = Join-Path `
                        $DestinationFolder `
                        $NewName

                    $Counter++

                } while (Test-Path -LiteralPath $DestinationPath)
            }


            # ------------------------------------------------
            # Move duplicate
            # ------------------------------------------------

            if (!$DryRun) {

                if (!(Test-Path -LiteralPath $DestinationFolder)) {

                    New-Item `
                        -ItemType Directory `
                        -Path $DestinationFolder `
                        -Force | Out-Null
                }


                Move-Item `
                    -LiteralPath $File.FullName `
                    -Destination $DestinationPath
            }


            Write-Host ""
            Write-Host "DUPLICATE:" -ForegroundColor Yellow
            Write-Host $File.Name


            $Report += [PSCustomObject]@{

                FileName = $File.Name

                OriginalPath = $File.FullName

                CreationDate = $CreationDate

                Destination = $DestinationPath

                Status = $Status
            }


            continue
        }


        # ----------------------------------------------------
        # First time seeing this file hash
        # ----------------------------------------------------

        $Hashes[$Hash] = $File.FullName


        # ----------------------------------------------------
        # Normal destination
        # ----------------------------------------------------

        $DestinationFolder = Join-Path `
            $SourceFolder `
            "$Year\$Month"


        $DestinationPath = Join-Path `
            $DestinationFolder `
            $File.Name


        # ----------------------------------------------------
        # Handle duplicate filename
        # ----------------------------------------------------

        if (Test-Path -LiteralPath $DestinationPath) {

            $Name = [System.IO.Path]::GetFileNameWithoutExtension(
                $File.Name
            )

            $Ext = $File.Extension

            $Counter = 1


            do {

                $NewName = "${Name}_${Counter}${Ext}"

                $DestinationPath = Join-Path `
                    $DestinationFolder `
                    $NewName

                $Counter++

            } while (Test-Path -LiteralPath $DestinationPath)


            $Status = "MOVED - Filename renamed"

        }
        else {

            $Status = "MOVED"
        }


        # ----------------------------------------------------
        # Actually move
        # ----------------------------------------------------

        if (!$DryRun) {

            if (!(Test-Path -LiteralPath $DestinationFolder)) {

                New-Item `
                    -ItemType Directory `
                    -Path $DestinationFolder `
                    -Force | Out-Null
            }


            Move-Item `
                -LiteralPath $File.FullName `
                -Destination $DestinationPath
        }


        Write-Host ""
        Write-Host "RESUME:" -ForegroundColor Green
        Write-Host $File.Name
        Write-Host "  -> $Year\$Month"


        $Report += [PSCustomObject]@{

            FileName = $File.Name

            OriginalPath = $File.FullName

            CreationDate = $CreationDate

            Destination = $DestinationPath

            Status = $Status
        }

    }


    # ========================================================
    # CASE 2:
    # Unsupported / unknown format
    # ========================================================

    else {

        $DestinationFolder = $DoItYourselfFolder

        $DestinationPath = Join-Path `
            $DestinationFolder `
            $File.Name


        $Status = "DO_IT_YOURSELF - Unsupported format"


        # ----------------------------------------------------
        # Handle duplicate filename
        # ----------------------------------------------------

        if (Test-Path -LiteralPath $DestinationPath) {

            $Name = [System.IO.Path]::GetFileNameWithoutExtension(
                $File.Name
            )

            $Ext = $File.Extension

            $Counter = 1


            do {

                $NewName = "${Name}_${Counter}${Ext}"

                $DestinationPath = Join-Path `
                    $DestinationFolder `
                    $NewName

                $Counter++

            } while (Test-Path -LiteralPath $DestinationPath)


            $Status = "DO_IT_YOURSELF - Filename renamed"
        }


        # ----------------------------------------------------
        # Actually move
        # ----------------------------------------------------

        if (!$DryRun) {

            if (!(Test-Path -LiteralPath $DestinationFolder)) {

                New-Item `
                    -ItemType Directory `
                    -Path $DestinationFolder `
                    -Force | Out-Null
            }


            Move-Item `
                -LiteralPath $File.FullName `
                -Destination $DestinationPath
        }


        Write-Host ""
        Write-Host "DO IT YOURSELF:" -ForegroundColor Magenta
        Write-Host $File.Name


        $Report += [PSCustomObject]@{

            FileName = $File.Name

            OriginalPath = $File.FullName

            CreationDate = $CreationDate

            Destination = $DestinationPath

            Status = $Status
        }
    }
}


# ============================================================
# 11. Finish progress bar
# ============================================================

Write-Progress `
    -Activity "Processing files" `
    -Completed


# ============================================================
# 12. Create CSV report
# ============================================================

if ($Report.Count -gt 0) {

    $Report | Export-Csv `
        -LiteralPath $ReportPath `
        -NoTypeInformation `
        -Encoding UTF8
}


# ============================================================
# 13. Finished
# ============================================================

Write-Host ""
Write-Host "==================================================" `
    -ForegroundColor Cyan


if ($DryRun) {

    Write-Host ""
    Write-Host "DRY RUN COMPLETE" `
        -ForegroundColor Yellow

    Write-Host ""
    Write-Host "NO FILES WERE MOVED." `
        -ForegroundColor Yellow

    Write-Host ""
    Write-Host "Review the results above."

    Write-Host ""
    Write-Host "If everything looks correct, change:" `
        -ForegroundColor Cyan

    Write-Host ""
    Write-Host '$DryRun = $true'

    Write-Host ""
    Write-Host "to:" `
        -ForegroundColor Cyan

    Write-Host ""
    Write-Host '$DryRun = $false'

}
else {

    Write-Host ""
    Write-Host "SORTING COMPLETE!" `
        -ForegroundColor Green

    Write-Host ""
    Write-Host "Report created at:"
    Write-Host $ReportPath
}


Write-Host ""
Write-Host "==================================================" `
    -ForegroundColor Cyan