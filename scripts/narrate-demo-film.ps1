param([string]$Storyboard = 'output/demo-film/storyboard.json')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$film = Get-Content -LiteralPath $Storyboard -Raw -Encoding UTF8 | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SelectVoice('Microsoft Zira Desktop')
    $synth.Rate = 0
    foreach ($scene in $film.scenes) {
        $audioPath = [IO.Path]::GetFullPath("output/demo-film/audio/$($scene.id).wav")
        $synth.SetOutputToWaveFile($audioPath)
        $synth.Speak([string]$scene.narration)
        $synth.SetOutputToNull()
        Write-Output "Narrated $($scene.id)"
    }
} finally { $synth.Dispose() }
