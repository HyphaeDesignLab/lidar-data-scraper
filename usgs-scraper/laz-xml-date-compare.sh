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

check_xml_dates_within_project() {
  for ddd in $(find projects/$1 -mindepth 2 -maxdepth 3 -type d -name 'meta' ); do
    last_dates='';
    has_dir_printed=''
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

if [ "$(basename $0)" = "laz-xml-date-compare.sh" ]; then
  $1 $2 $3
fi

