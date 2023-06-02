#!/bin/bash

scrape_log="$1"
only_once="$2"
for i in $(seq 1 2000); do
  echo
  echo
  date
  ./projects-stats.sh general
  wc -l $scrape_log
  grep '(project' $scrape_log | tail -1
  grep '(subproject' $scrape_log | tail -1
  echo
  echo
  sleep 2

done
