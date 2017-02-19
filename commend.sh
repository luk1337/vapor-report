#!/bin/bash
counter=0
accounts=`find users -type f -not -name example.json | wc -l`

usage() {
    echo "[#] Usage: ./commend.sh [steamID64]"
    exit 0
}

if [ -z "$1" ]; then
    usage
fi

node protos/updater.js

for user in `find users -type f -not -name example.json`; do
    command="node commend.js $user"

    for arg in "$*"; do
       command+=" $arg"
    done

    $command

    # Increment and print the counter
    counter=$((counter + 1))
    echo "[INFO] Status : $counter/$accounts"
done
