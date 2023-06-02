
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
    if [ "$1" ]; then
        wc -l $1 | sed -E -e 's/^ *([0-9]+) .+/\1/' -e 's/^0$//' | xargs echo -n;
    else
        local i=0
        while read -r data; do
            i=$(expr $i+1)
        done
        if [ "$i" = "0" ]; then
            echo -n ''
        else
            echo -n $i
        fi
    fi
}
get_line_count() {
    if [ "$1" ]; then
        wc -l $1 | sed -E -e 's/^ *([0-9]+) .+/\1/' | xargs echo -n;
    else
        local i=0
        while read -r data; do
            i=$(expr $i+1)
        done
        echo -n $i
    fi
}
