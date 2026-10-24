param (
    [string]$AudioPath
)

Add-Type -AssemblyName System.Speech

if (-not (Test-Path $AudioPath)) {
    Write-Output '{"success":false,"error":"File not found"}'
    exit 0
}

$ext = [System.IO.Path]::GetExtension($AudioPath).ToLower()
$targetWav = $AudioPath

# If not WAV, transcode using Windows Media Foundation
if ($ext -ne '.wav') {
    $targetWav = [System.IO.Path]::ChangeExtension($AudioPath, '.converted.wav')
    try {
        $sourceFile = [System.IO.Path]::GetFullPath($AudioPath)
        $destFile = [System.IO.Path]::GetFullPath($targetWav)

        [Windows.Media.Transcoding.MediaTranscoder, Windows.Media, ContentType=WindowsRuntime] | Out-Null
        [Windows.Media.MediaProperties.MediaEncodingProfile, Windows.Media, ContentType=WindowsRuntime] | Out-Null
        [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null

        $srcTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($sourceFile)
        $src = $srcTask.GetAwaiter().GetResult()

        $destTask = [Windows.Storage.StorageFile]::CreateFileAsync($destFile, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)
        $dest = $destTask.GetAwaiter().GetResult()

        $profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality]::High)
        $transcoder = [Windows.Media.Transcoding.MediaTranscoder]::new()

        $prepTask = $transcoder.PrepareFileTranscodeAsync($src, $dest, $profile)
        $prepare = $prepTask.GetAwaiter().GetResult()

        if ($prepare.CanTranscode) {
            $transcodeTask = $prepare.TranscodeAsync()
            $transcodeTask.GetAwaiter().GetResult()
        }
    } catch {
        # Transcoding fallback
    }
}

try {
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    $engine.SetInputToWaveFile($targetWav)
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $res = $engine.Recognize([TimeSpan]::FromSeconds(15))
    $engine.Dispose()

    if ($res -and $res.Text) {
        $cleanText = $res.Text
        $confidence = $res.Confidence
        [PSCustomObject]@{ success = $true; text = $cleanText; confidence = $confidence } | ConvertTo-Json -Compress
    } else {
        [PSCustomObject]@{ success = $false; text = ""; error = "No speech detected" } | ConvertTo-Json -Compress
    }
} catch {
    $err = $_.Exception.Message
    [PSCustomObject]@{ success = $false; error = $err } | ConvertTo-Json -Compress
} finally {
    if ($targetWav -ne $AudioPath -and (Test-Path $targetWav)) {
        Remove-Item $targetWav -ErrorAction SilentlyContinue
    }
}
