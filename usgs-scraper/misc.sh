#!/bin/bash

compare_xml_to_laz_date() {
  last_proj=''
  for dd in $(ls projects/*/*/meta/*laz.txt | head -100); do
    last_proj=
    echo $dd
    cat $dd | grep date | sed -E -e 's/start/sta/' -e 's/([a-z_]+:[0-9]{8}).+/laz: \1/'
    cat $(echo $dd | sed -e 's/.laz.txt/.txt/') | grep date | sed -E -e 's/start/sta/' -e 's/([a-z_]+:[0-9]{8}).*/xml: \1/'
    echo '-----------'
    echo
  done

}

extract_xml_dates_on_one_line() {
  sed -nE  -e '/(date_start|begdate):/ {s/(date_start|begdate)://;N;s/\x0a/-/g;s/\n/-/g;s/(date_end|enddate)://;p;}' $1
}

get_days_of_date_range() {
  echo $1 | sed -E -e 's/([0-9]{4})([0-9][0-9])([0-9][0-9])-([0-9]{4})([0-9][0-9])([0-9][0-9])/expr \\( \4 - \1 \\) \\* 365 + \\( \5 - \2 \) \\* 30 + \6 - \3/' > /tmp/xml-date-range.sh
  chmod u+x /tmp/xml-date-range.sh
  . /tmp/xml-date-range.sh
  rm /tmp/xml-date-range.sh
}
is_date_leaves_on() {
  # return the boolean (1 or 0) of this:
  #    year2 - year1 == 0  AND month1+day > 4030 AND month2+day2 < 1001
  #    if date is between (and including) 05/01 and 09/30 (of the same year)
  eval $(sed -E -e 's/([0-9]{4})([0-9][0-9])([0-9][0-9])-([0-9]{4})([0-9][0-9])([0-9][0-9])/expr \4 - \1 = 0 \\\& \5\6 - 1001 \\< 0 \\\& \2\3 - 0430 \\> 0/' <<< "$1")
}
is_date_leaves_off() {
  # return boolean (1 or 0) of
  # if year is SAME
  #   month1 > 1031 OR month2 < 0401 )
  # if year is DIFFERENT
  #   year2 > year1 AND (month1 > 1031 AND month2 < 0401 )


  eval $(sed -E -e 's/([0-9]{4})([0-9][0-9])([0-9][0-9])-([0-9]{4})([0-9][0-9])([0-9][0-9])/expr \\( \4 - \1 = 1 \\\& \2\3 - 1031 \\> 0 \\\& \5\6 - 0401 \\< 0 \\) \\| \\( \4 - \1 = 0 \\\& \\( \5\6 - 0401 \\< 0 \\| \2\3 - 1031 \\> 0 \\) \\)/' <<< "$1")
}

check_xml_dates_within_project() {
  path_search='';
  if [ "$1" ]; then path_search="-path *$1*"; fi
  for ddd in $(find projects/ -mindepth 2 -maxdepth 3 -type d -name 'meta' $path_search ); do
    last_dates='';
    has_dir_printed='';
    for fff in $ddd/*xml.txt; do
      curr_dates=$(extract_xml_dates_on_one_line $fff);
      if [ "$last_dates" != "" ] && [ "$last_dates" != "$curr_dates" ]; then
        if [ ! "$has_dir_printed" ]; then echo $ddd; has_dir_printed=1; fi
        echo dates differ $curr_dates '==>' $last_dates
      fi
      last_dates=$curr_dates
      if [ "$(echo $curr_dates | sed -nE -e '/^-|-$/ p')" ]; then
        if [ ! "$has_dir_printed" ]; then echo $ddd; has_dir_printed=1; fi
        echo some date is missing "($curr_dates)"
      fi
    done 2>/dev/null
  done

}
make_xml_date_report() {
  path_search='';
  if [ "$1" ]; then path_search="-path *$1*"; fi
  for ddd in $(find projects/ -mindepth 2 -maxdepth 3 -type d -name 'meta' $path_search ); do
    last_dates='';
    has_dir_printed='';
    for fff in $(ls -1 $ddd/*.xml.txt); do
      curr_dates=$(extract_xml_dates_on_one_line $fff);
      if [ "${#curr_dates}" -gt '8' ]; then
        echo 'dates:'$curr_dates > $ddd/project-length-days.txt;
        echo -n 'days:' >> $ddd/project-length-days.txt;
        get_days_of_date_range $curr_dates >> $ddd/project-length-days.txt
        break
      fi
      break; # run only ONCE
    done 2>/dev/null
  done

}
get_leaves_on_off() {
  path_search='';
  if [ "$1" ]; then path_search="-path *$1*"; fi
  for ddd in $(find projects/ -mindepth 2 -maxdepth 3 -type d -name 'meta' $path_search ); do
    get_leaves_on_off__single $ddd;
  done
}

get_leaves_on_off__single() {
  local ddd="$1"
  local all_leaves_status=''
  for fff in $(ls -1 $ddd/*.xml.txt); do
    curr_dates=$(extract_xml_dates_on_one_line $fff);
    if [ "${#curr_dates}" -gt '8' ]; then # >8 means something like 8 + 8 + 1 = YYYYMMDD-YYYYMMDD
      local leaves_status='';
      rm $ddd/leaves-*.txt 2>dev/null
      if [ "$(is_date_leaves_on $curr_dates)" = '1' ]; then leaves_status=on;
      elif [ "$(is_date_leaves_off $curr_dates)" = '1' ]; then leaves_status=off;
      else leaves_status='mixed'; fi

      # skip if not set
      if [ ! "$leaves_status" ]; then
        continue;
      fi

      # compare last to current (if last is set)
      if [ "$all_leaves_status" ]; then
        if [ "$leaves_status" = 'mixed' ]; then
          all_leaves_status='mixed' # if current mixed, then call the entire set MIXED, and stop iterating (no need to check the rest)
          break;
        fi

        if [ "$all_leaves_status" != "$leaves_status" ]; then
          all_leaves_status='mixed' # if last and current NOT SAME, then call entire set MIXED, stop iterating
          break;
        fi
      fi

      # save to last if set
      if [ "$leaves_status" ]; then
        all_leaves_status=$leaves_status
      fi
    fi
  done 2>/dev/null
  echo $(sed -E -e 's@projects/+@@;s@/meta/?@@;' <<<$ddd) $all_leaves_status
  echo $all_leaves_status > $(dirname $ddd)/leaves_status.txt
}

get_laz_areas() {
  path_search='';
  if [ "$1" ]; then path_search="-path *$1*"; fi
  for ddd in $(find projects/ -mindepth 2 -maxdepth 3 -type d -name 'meta' $path_search ); do
    for fff in $(ls -1 $ddd/*.xml.txt); do
      echo $fff
      grep -E '(south|north|east|west)' $fff
    done 2>/dev/null
  done > tmp123456789.txt
  python3 calculate-areas.py tmp123456789.txt
  rm tmp123456789.txt
}

downloaded_files_report() {
  local _d
  local _dindexcount
  local _dfull
  local _dempty


  # get meta dirs
  find projects/ -mindepth 3 -maxdepth 4 -name 'meta' -type d > meta

   # get line count in _index/current/xml_files.txt
   for _d in $(cat projects.txt); do
     _dindexcount=0;
     if [ -f "$_d/_index/current/xml_files.txt" ]; then _dindexcount=$(wc -l $_d/_index/current/xml_files.txt | cut -d' ' -f1); fi; echo $_dindexcount; done > xml_full_empty.report2

  # get FULL and EMPTY XML counts
  for _d in $(cat projects/_meta_dirs.txt); do
    _dfull=0; _dempty=0; for _f in $(find $_d -type f -name '*xml'); do if [ ! -s $_f ]; then ((_dempty++)); else ((_dfull++)); fi; done; echo $_d $_dfull empty $_dempty; done > xml_full_empty.report

}


if [ "$(basename $0)" = "laz-xml-misc.sh" ]; then
  $1 $2 $3
fi

