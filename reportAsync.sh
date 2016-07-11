#!/bin/bash
usage() {
    echo "[#] Usage: ./report.sh [steamID64]"
    exit 0
}

if [ -z "$1" ]; then
    usage
fi

node protos/updater.js

for user in `ls users/[!example]*.json`; do
    session_name="vapor-report_$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)"
    command="node report.js $user $1"
    screen -dmS $session_name $command
done
