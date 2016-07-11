#!/bin/bash
usage() {
    echo "[#] Usage: ./commend.sh [steamID64]"
    exit 0
}

if [ -z "$1" ]; then
    usage
fi

node protos/updater.js

for user in `find users -type f -not -name example.json`; do
    session_name="vapor-commend_$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)"
    command="node commend.js $user $1"
    screen -dmS $session_name $command
done
