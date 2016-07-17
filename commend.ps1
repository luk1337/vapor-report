$counter = 0
$accounts = (Get-ChildItem .\users\*.json -Exclude example.json).Count
$steamId = Read-Host -Prompt 'Enter the steamID64s you want to commend'

node protos/updater.js

foreach ($account in $(Get-ChildItem .\users\*.json -Exclude example.json)) {
    iex "node commend.js '$account' $steamId"

    $counter++
    echo "[INFO] Status : $counter/$accounts"
}

pause
