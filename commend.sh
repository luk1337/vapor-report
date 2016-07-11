#!/bin/bash
counter=0
accounts=`ls users/[!example]*.json | wc -l`

usage() {
    echo "[#] Usage: ./commend.sh [steamID64]"
    exit 0
}

if [ -z "$1" ]; then
    usage
fi

node protos/updater.js

for user in `ls users/[!example]*.json`; do
    node commend.js $user $1

    # Increment and print the counter
    counter=$((counter + 1))
    echo "[INFO] Status : $counter/$accounts"
done
