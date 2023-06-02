
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
