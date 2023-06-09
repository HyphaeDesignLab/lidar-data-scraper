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
  for fff in projects/*/*/meta/*xml.txt projects/*/meta/*xml.txt; do
    echo $fff | sed -E -e 's@.+/(.+/.+)/meta/[^/]+@\1@' -e 's@.+/(.+)/meta/[^/]+@\1@'
    sed -nE -e '
    /begdate:/ {
      s/begdate://
      N
      s/\n/-/
      s/enddate://
      p
    }
    ' $fff
  done

}

check_xml_dates_within_project $1
