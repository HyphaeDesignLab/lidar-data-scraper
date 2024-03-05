___utils_sh_included=1
if [ "$LIDAR_SCRAPER_DEBUG" ]; then
  set -x
fi

has_arg_search_args=''
init_has_arg () {
  has_arg_search_args=$@
}
init_has_arg "$@"

has_arg () {
  for arg in $has_arg_search_args; do
    if [ "$1" = "$arg" ]; then
      echo $1;
      return
    fi
  done;
}


echo_if_debug() {
  if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
    local item_i=''
    for item_i in "$@"; do
      echo ' #debug: ' $item_i;
    done
  fi
}

LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PORT=8099
LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS="http://localhost:$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PORT"
start_mock_server_debug() {
  if [ "$LIDAR_SCRAPER_DEBUG__MOCK_SERVER" = '' ]; then
    return;
  fi

  LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID=$(ps aux | grep http.server | grep -v 'grep http.server' | sed -E -e 's/ +/ /g' | cut -d' ' -f2); # output of the & will return "[1] <PID>"
  if [ "$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID" != '' ]; then
    return;
  fi

  python3 -m http.server --directory projects/_server_mock/ $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PORT 2>projects/_server_mock/err 1>projects/_server_mock/log &
  LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID=$(ps aux | grep http.server | grep -v 'grep http.server' | sed -E -e 's/ +/ /g' | cut -d' ' -f2); # output of the & will return "[1] <PID>"
  echo " Started mock server $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS (process ID: $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID)"
}
stop_mock_server_debug() {
  if [ "$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID" != '' ]; then
    echo ' Stopping mock server'
    kill $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_PID;
  else
    echo ' No mock server to stop'
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
  __LIDAR_SCRAPER_scrape_count=0 # global variable
  echo > scrape-rest.txt;
}
# run it immediately
throttle_scrape_reset;

# take x_scrape/y_second_rest argument pairs
#  e.g. 250/60, 50/20, ... = for every 250 scrapes rest 60 seconds, for every 50 rest 20
throttle_scrape() {
    ((__LIDAR_SCRAPER_scrape_count++))

    for every_x_rest_y in "$@"; do
      local every_x=$(cut -d'/' -f1 <<< $every_x_rest_y);
      local rest_y_seconds=$(cut -d'/' -f2 <<< $every_x_rest_y);
      if [ "$(expr $__LIDAR_SCRAPER_scrape_count % $every_x)" = "0" ]; then
        echo "every $every_x scrapes rest $rest_y_seconds seconds" >> scrape-rest.txt;
        sleep $rest_y_seconds;

        if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
          date >> throttle-scrape.log;
          echo $__LIDAR_SCRAPER_scrape_count "($@)" >> throttle-scrape.log;
        fi
        return; # break out of for-loop (as first match/condition suffices)
      fi
    done

    # default sleep throttle
    sleep .5
}

curl_scrape() {
  # args: 1 = url, 2 = HTML body output, 3 = http_response (stdout), 4 = errors (stderr)
  echo -n > $2
  echo -n > $3
  echo -n > $4
  #
  # --location: follow 3xx HTTP response redirects
  # -f: return a script error on server errors 400+ (turns http responses 400+ into transient errors AND script errors)
  # --retry: if a transient error is returned when curl tries to perform a transfer, it will retry this number of times before giving up
  # --retry-connrefused: treats connection refused/timeout as transient, will trigger retry
  # -w http_code:  will print the HTTP RESPONSE code to stdout
  # -s -S: will not print out a body if a 400+ HTTP response error, but will print error to stderr
  # -o: will save the body of 200 HTTP response
  curl \
    --location \
    -f \
    --connect-timeout 5 \
    --retry 4 --retry-connrefused \
    -w '%{http_code}' \
    -s -S \
    -o $2 \
    $1 \
      1>> $3 \
      2>> $4

  return $?
}

# generic loop (recursive) on all projects/subprojects indeces
#  each loop calls the fn_callback with 1 argument (the project ID/path)
#  fn_callback_arg_format is the format in which the argument is passed to callback
#   e.g. 'projects/%s/_index/current' means that the fn_callback is called like this
#             fn_callback 'projects/some_project/_index/current
loop_on_projects() {
  local project="$1"
  local fn_callback="$2"
  local fn_callback_arg_format="$3"
  local limit="$4"
  local is_recursive="$5"

  local project_path='projects'
  if [ "$project" = 'all' ]; then
    project=''
  fi

  if [ "$project" ]; then
    project_path="projects/$project"
  fi

  echo
  echo $project_path
  if [ ! -d $project_path ]; then
    echo ' does not exist'
    return;
  fi

  local project_callback_arg=$(printf $fn_callback_arg_format $project_path)
  echo "calling $fn_callback with $project_callback_arg (limit: $limit)"
  eval $fn_callback $project_callback_arg

  if [ "$is_recursive" != 'yes' ]; then
    return
  fi

  local index=()
  if [ "$limit" ]; then
    index=($(cat $project_path/_index/current/index.txt 2>/dev/null | grep -v '^$' | sort | head -$limit))
  else
    index=($(cat $project_path/_index/current/index.txt 2>/dev/null | grep -v '^$' | sort))
  fi
  local item_i='';
  for item_i in ${index[@]}; do
    local item_i_arg=$item_i
    if [ "$project" ]; then
       item_i_arg=$project/$item_i
     fi
    loop_on_projects $item_i_arg $fn_callback $fn_callback_arg_format $limit $is_recursive
  done
}

loop_test_fn() {
  echo 'loop_test_fn callback: ' $1
}
loop_test() {
  echo loop_test
  loop_on_projects 'all' loop_test_fn 'custom_arg/%s/__' 3
}

if [ "$1" = 'loop_test' ]; then
  loop_test;
fi