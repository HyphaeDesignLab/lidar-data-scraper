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

check_xml_dates_within_project() {
  for ddd in $(find projects/ -mindepth 2 -maxdepth 3 -type d -name 'meta'); do
    echo $ddd;
    for fff in $ddd/*xml.txt; do
      sed -nE -e '/date_start:/ {s/date_start://;N;s/\n/-/;s/date_end://;p;}' $fff
    done 2>/dev/null
  done

}

if [ "$(basename $0)" = "laz-xml-date-compare.sh" ]; then
  $1 $2 $3
fi

