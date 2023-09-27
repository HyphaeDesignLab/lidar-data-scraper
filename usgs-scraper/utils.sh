
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

# take x_scrape/y_second_rest argument pairs
#  e.g. 250/60, 50/20, ... = for every 250 scrapes rest 60 seconds, for every 50 rest 20
throttle_scrape() {
    scrape_count=$(expr $scrape_count + 1)

    date >> scrape-rest.txt;
    for every_x_rest_y in "$@"; do
      local every_x=$(cut -d'/' -f 1 <<< $every_x_rest_y);
      local rest_y_seconds=$(cut -d'/' -f 2 <<< $every_x_rest_y);
      if [ "$(expr $scrape_count % $every_x)" = "0" ]; then
        echo "every $every_x scrapes rest $rest_y_seconds seconds" >> scrape-rest.txt;
        sleep $rest_y_seconds;
        return; # break out of for-loop (as first match/condition suffices)
      fi
    done

    # default sleep throttle
    sleep .5
}