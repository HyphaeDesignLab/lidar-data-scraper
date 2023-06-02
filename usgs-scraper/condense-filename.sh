#!/bin/bash

for project in $(find projects/ -type d -d 1 \( ! -name '_index' \)); do

    if [ -d projects/$project/meta ] && [ $(wc -l projects/$project/meta/xml_files.txt | sed -E -e 's/^ *([0-9]+) .+$/\1/') != "0" ]; then
        echo -n 'USGS_LPC_ :' &&  grep -c 'USGS_LPC' projects/$project/meta/xml_files.txt
        echo -n 'project prefix:' &&  grep -c "$project" projects/$project/meta/xml_files.txt
    else
        for subproject in $(find projects/$project/ -type d -d 1 \( ! -name '_index' \) \( ! -name 'meta' \)); do
            if [ -d projects/$project/$subproject/meta ] && [ $(wc -l projects/$project/$subproject/meta/xml_files.txt | sed -E -e 's/^ *([0-9]+) .+$/\1/') != "0" ]; then
                    echo -n 'USGS_LPC_ :' &&  grep -c 'USGS_LPC' projects/$project/$subproject/meta/xml_files.txt
                    echo -n 'project prefix:' &&  grep -c "$project" projects/$project/$subproject/meta/xml_files.txt
            fi
        done;
    fi;
done;
