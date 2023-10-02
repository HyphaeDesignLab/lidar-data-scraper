script_base_dir=$(pwd)
. ./utils.sh
. ./utils-stats.sh

scrape_index_helper() {
  local project_path="projects"
  if [ $project ]; then
    project_path="projects/$project"
  fi

  #backup_dir=backup/2023-05-29---15-56-46

  # Make a new back-up dir, download/parse new data into it
  local backup_dir=$project_path/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)

  # Compare it to the current (about to become last-backup)
  local current_dir=$project_path/_index/current

  # DOWNLOAD
  scrape_index_helper__curl $backup_dir

  # Parse data out of index.html
  scrape_index_helper__parse_index $backup_dir

  # Do diff with previous backup (aka current current)
  scrape_index_helper__diff $backup_dir $current_dir

  # Backup: make new back-up => current
  scrape_index_helper__backup $backup_dir $current_dir
}

scrape_index_helper__curl() {
  local download_dir="$1"
  mkdir -p $download_dir

  local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
  if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
    base_url=$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS
    echo_if_debug "scrape-index-helper.sh: mock server in use: $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS"
  fi

  curl_scrape $base_url/$project/ $download_dir/___index.html $download_dir/___http_code.txt $download_dir/___errors.txt
  if [ $? != 0 ]; then
    # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
    date > $download_dir/errors.txt
    cat $download_dir/___errors.txt >> $download_dir/errors.txt
    echo -n 'HTTP response: ' >> $download_dir/errors.txt
    cat $download_dir/___http_code.txt >> $download_dir/errors.txt
  else
    # if no errors
    # strip index.html of unnecessary stuff
    grep -E '<img[^>]+alt="\[DIR\]">' $download_dir/___index.html > $download_dir/index.html

    if [ "$LIDAR_SCRAPER_DEBUG" = '' ]; then
      # if no errors and NOT debugging, save index.html to server_mock dir for local testing
      mkdir -p projects/_server_mock/$project
      cp $download_dir/index.html projects/_server_mock/$project/index.html
    fi
  fi

  # remove temporary files
  rm $download_dir/___*
}

scrape_index_helper__parse_index() {
  local download_dir="$1"
  
  # get directory name and last modified out of HTML
  #    skip (d=delete) all lines that are not DIR
  #    get the href PATH and the YYYY-MM-DD HH:MM timestamp and -/12K/1.2M/200M file size
  #    finally remove slashes in href PATH and trailing - (i.e. missing/not-applicable file size)
  sed -E \
    -e '/<img[^>]+alt="\[DIR\]">/ !d' \
    -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
    -e 's@/@@;s/-$//;' \
    $download_dir/index.html >$download_dir/___dirs_and_details.txt

  # get sub-project directories (i.e. containing underscore (_))
  #   save them to index_*.txt
  grep '_' $download_dir/___dirs_and_details.txt > $download_dir/index_details.txt
  if [ $? = 0 ]; then
    echo -n projects > $download_dir/contents-type.txt
    sed -E -e 's/^([^~]+)~.+/\1/' $download_dir/index_details.txt >$download_dir/index.txt


    python3 $script_base_dir/get-project-year-and-state.py $download_dir/index.txt >$download_dir/index_with_year_and_state.txt
  else
    rm $download_dir/index_details.txt
  fi

  # get meta/laz/las directories
  grep -v '_' $download_dir/___dirs_and_details.txt | grep -Eoi '^(meta(data)?|la[zs])~'> $download_dir/data_details.txt
  if [ $? = 0 ]; then
    grep -Eio '^meta(data)?~' $download_dir/data_details.txt 2>/dev/null | tr -d '~' > $download_dir/metadata_dir.txt
    if [ -s $download_dir/metadata_dir.txt ]; then
      echo -n data > $download_dir/contents-type.txt
    else
      rm $download_dir/metadata_dir.txt
    fi
    grep -Eio '^la[zs]~' $download_dir/data_details.txt 2>/dev/null | tr -d '~' > $download_dir/laz_dir.txt
    if [ -s $download_dir/laz_dir.txt ]; then
      echo -n data > $download_dir/contents-type.txt
    else
      rm $download_dir/laz_dir.txt
    fi
  else
    rm $download_dir/data_details.txt
  fi

  # remove temporary files
  rm $download_dir/___*
}

scrape_index_helper__diff() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  ### START DIFF/STATS
  local data_type=$(cat $backup_dir/contents-type.txt)
  ### MAKE STATS / DIFF with previous (currents)
  if [ -d $current_dir ]; then
    if [ "$data_type" = 'projects' ]; then
      python3 diff_file_list.py $current_dir/index_details.txt $backup_dir/index_details.txt $backup_dir/
    fi

   # diff on meta/laz dir details
    if [ "$data_type" = 'data' ]; then
      python3 diff_file_list.py $current_dir/data_details.txt $backup_dir/data_details.txt $backup_dir/
    fi
  else
    echo 'first time scraping' > $backup_dir/diff.txt
  fi
  ### END DIFF/STATS
}

scrape_index_helper__backup() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  if [ -d $current_dir ]; then
    rm -rf $current_dir
  fi
  cp -r $backup_dir $current_dir
}

if [ "$(basename $0)" = "scrape-index-helper.sh" ]; then
    if [ "$1" = 'main' ]; then
      scrape_index_helper $1
    elif [ "$1" = 'loop' ]; then
      if [ ! "$2" ] || [ ! "$3" ] || [ ! "$4" ]; then
        echo ' call the "loop" tester with 5 arguments'
        echo '   1="loop" to invoke the tester'
        echo '   2=callback_function_to_test and call for every loop '
        echo '       possible value: '
        echo '          get           => get from URL  (scrape_index_helper__curl)'
        echo '          parse         => parse index  (scrape_index_helper__parse_index)'
        echo '          diff          => diff the previous and current index (scrape_index_helper__diff)'
        echo '          backup        => backup the current (scrape_index_helper__backup)'
        echo '   3=project  to loop on: possible values: "all", "project" or "project/subproject"'
        echo '   4=arg_format  to pass to callback fn: e.g. "%s/_index/backup/2023-04-05"'
        echo '   5=limit  of loop iterations'
        echo '   6=is recursive loop (yes/no)'
      else
        ___lidar_scrape_project="$3"
        if [ ! "$___lidar_scrape_project" ]; then
          ___lidar_scrape_project='all';
        fi
        # $2 will contain the callback fn label
        if [ "$2" = 'get' ]; then
          loop_on_projects $___lidar_scrape_project scrape_index_helper__curl $4 $5 $6
        elif [ "$2" = 'parse' ]; then
          loop_on_projects $___lidar_scrape_project scrape_index_helper__parse_index $4 $5 $6
        elif [ "$2" = 'diff' ]; then
          loop_on_projects $___lidar_scrape_project scrape_index_helper__diff $4 $5 $6
        elif [ "$2" = 'backup' ]; then
          loop_on_projects $___lidar_scrape_project scrape_index_helper__backup $4 $5 $6
        fi
      fi
    fi
fi