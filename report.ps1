$counter = 0
$accounts = (Get-ChildItem .\users\* -Exclude example.json).Count
$steamId = Read-Host -Prompt 'Enter the steamID64 you want to report'
$matchId = Read-Host -Prompt 'Enter the matchId if you have it'

node protos/updater.js

foreach ($account in $(Get-ChildItem .\users\* -Exclude example.json)) {
    iex "node report.js '$account' $steamId $matchId"

    $counter++
    echo "[INFO] Status : $counter/$accounts"
}

pause
