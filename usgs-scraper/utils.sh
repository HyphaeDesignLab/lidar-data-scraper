
has_arg_search_args=''
init_has_arg () {
  has_arg_search_args=$@
}

has_arg () {
  for arg in $has_arg_search_args; do
    if [ "$1" = "$arg" ]; then
      echo $1;
      return
    fi
  done;
}


echo_if_debug() {
  if [ "$LIDAR_SCRAPER_DEBUG" = '1' ]; then
    echo $@
  fi
}


get_line_count_or_empty() {
  wc -l $1 | sed -E -e 's/^ *([0-9]+).*$/\1/' -e 's/^0$//' | xargs echo -n;
}
format_line_count_or_empty() {
  echo $1 | sed -E -e 's/^ *([0-9]+).*$/\1/' -e 's/^0$//' | xargs echo -n;
}
get_line_count() {
  wc -l $1 | sed -E -e 's/^ *([0-9]+).*$/\1/'  | xargs echo -n;
}
format_line_count() {
  echo $1 | sed -E -e 's/^ *([0-9]+).*$/\1/' | xargs echo -n;
}

throttle_scrape_reset() {
  scrape_count=0 # global variable
  echo > scrape-rest.txt;
}
# run it immediately
throttle_scrape_reset;
throttle_scrape() {
    scrape_count=$(expr $scrape_count + 1)

    date >> scrape-rest.txt;
    if [ "$(expr $scrape_count % 250)" = "0" ]; then
        echo 'every 250 scrapes rest 60 seconds' >> scrape-rest.txt;
        sleep 60
    elif [ "$(expr $scrape_count % 50)" = "0" ]; then
        echo 'every 50 scrapes rest 20 seconds' >> scrape-rest.txt;
        sleep 20
    elif [ "$(expr $scrape_count % 20)" = "0" ]; then
        echo 'every 20 scrapes rest 10 seconds' >> scrape-rest.txt;
        sleep 10
    elif [ "$(expr $scrape_count % 10)" = "0" ]; then
        echo 'every 10 scrapes rest 3 seconds' >> scrape-rest.txt;
        sleep 3
    elif [ "$(expr $scrape_count % 5)" = "0" ]; then
        echo 'every 5 scrapes rest 2 seconds' >> scrape-rest.txt;
        sleep 2
    else
        sleep .5
    fi
}