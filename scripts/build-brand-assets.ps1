param(
    [string]$Source = "logos/light mode logo.png",
    [string]$Output = "apps/web/src/assets/brand"
)

Add-Type -AssemblyName System.Drawing
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outputPath = Join-Path (Resolve-Path .).Path $Output
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

function New-TransparentLogo([bool]$darkVariant) {
    $sourceBitmap = [System.Drawing.Bitmap]::new($sourcePath)
    $result = [System.Drawing.Bitmap]::new($sourceBitmap.Width, $sourceBitmap.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $sourceBitmap.Height; $y++) {
        for ($x = 0; $x -lt $sourceBitmap.Width; $x++) {
            $pixel = $sourceBitmap.GetPixel($x, $y)
            $maximum = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
            if ($maximum -le 9) {
                $result.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                continue
            }
            $alpha = if ($maximum -ge 25) { 255 } else { [int](255 * ($maximum - 9) / 16) }
            $red = [Math]::Min(255, [int]($pixel.R * 255 / [Math]::Max(1, $alpha)))
            $green = [Math]::Min(255, [int]($pixel.G * 255 / [Math]::Max(1, $alpha)))
            $blue = [Math]::Min(255, [int]($pixel.B * 255 / [Math]::Max(1, $alpha)))
            if ($darkVariant -and $y -gt 795) {
                $luma = [int](0.2126 * $red + 0.7152 * $green + 0.0722 * $blue)
                if ($luma -lt 125) {
                    # Lift only the dark wordmark/tagline region for contrast on dark surfaces.
                    $amount = 0.82
                    $red = [Math]::Min(255, [int]($red + (198 - $red) * $amount))
                    $green = [Math]::Min(255, [int]($green + (208 - $green) * $amount))
                    $blue = [Math]::Min(255, [int]($blue + (242 - $blue) * $amount))
                }
            }
            $result.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $red, $green, $blue))
        }
    }
    $sourceBitmap.Dispose()
    return $result
}

function Export-Crop($bitmap, [System.Drawing.Rectangle]$crop, [int]$width, [string]$name) {
    $height = [int][Math]::Round($width * $crop.Height / $crop.Width)
    $target = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($bitmap, [System.Drawing.Rectangle]::new(0, 0, $width, $height), $crop, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $target.Save((Join-Path $outputPath $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $target.Dispose()
}

$light = New-TransparentLogo $false
$dark = New-TransparentLogo $true
$full = [System.Drawing.Rectangle]::new(52, 158, 1150, 920)
$mark = [System.Drawing.Rectangle]::new(350, 158, 555, 650)
$wordmark = [System.Drawing.Rectangle]::new(55, 810, 1145, 275)
Export-Crop $light $full 720 "syncora-logo-light.png"
Export-Crop $dark $full 720 "syncora-logo-dark.png"
Export-Crop $light $mark 320 "syncora-mark.png"
Export-Crop $light $wordmark 720 "syncora-wordmark.png"
$light.Dispose()
$dark.Dispose()
