$counter = 0
$accounts = (Get-ChildItem .\users\*.json -Exclude example.json).Count
$steamId = Read-Host -Prompt 'Enter the steamID64s you want to report'

node protos/updater.js

foreach ($account in $(Get-ChildItem .\users\*.json -Exclude example.json)) {
    iex "node report.js '$account' $steamId"

    $counter++
    echo "[INFO] Status : $counter/$accounts"
}

pause
