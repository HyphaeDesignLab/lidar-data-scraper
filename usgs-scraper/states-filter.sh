#!/bin/bash

filter_project_list() {
  local state_abbr=$1
  local input_file=$2

  if [ ! "$state_abbr" ]; then
    find projects/ -maxdepth 4 -mindepth 3 -type d -name 'meta' | sed -E -e 's@(^|.+/)projects/+@@;s@/meta$@@;'
    return 0
  fi

  local state_name_and_abbr;
  local state_name;
  local grep_pattern;
  
  state_name_and_abbr=$(grep "~$1" states.txt)
  state_name=$(cut -d'~' -f1 <<< $state_name_and_abbr)
  grep_pattern="(_${state_abbr}_|\b${state_abbr}_|_${state_abbr}\b|\b${state_abbr}\b|$state_name)"

  if [ "$input_file" ] && [ -f "$input_file" ]; then
    cat $input_file | sed -E -e 's@(^|.+/)projects/+@@;s@/meta$@@;' | grep -iE "$grep_pattern"
  else
    find projects/ -maxdepth 4 -mindepth 3 -type d -name 'meta' | sed -E -e 's@(^|.+/)projects/+@@;s@/meta$@@;' | grep -iE "$grep_pattern"
  fi
}

filter_project_list $1