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
  sed -nE  -e '/(date_start|begdate):/ {s/(date_start|begdate)://;N;s/\x0a/-/g;s/\n/-/g;s/(date_end|enddate)://;p;}' $@
}
get_days_of_date_range() {
  year1=$(echo $1 | cut -c 1-4)
  year2=$(echo $1 | cut -c 10-13)
  month1=$(echo $1 | cut -c 5,6)
  month2=$(echo $1 | cut -c 14,15)
  day1=$(echo $1 | cut -c 7,8)
  day2=$(echo $1 | cut -c 16,17)
  expr \( $year2 - $year1 \) \* 365 + \( $month2 - $month1 \) \* 30 + $day2 - $day1
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
    done 2>/dev/null
  done

}

if [ "$(basename $0)" = "laz-xml-date-compare.sh" ]; then
  $1 $2 $3
fi

