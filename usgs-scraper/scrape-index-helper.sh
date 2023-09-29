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
  mkdir -p $backup_dir

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

  local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
  if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
    base_url=$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS
    echo_if_debug "scrape-index-helper.sh scrape index helper: mock server in use: $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS"
  fi

  curl_scrape $base_url/$project/ $download_dir/___index.html $download_dir/___http_code.txt $download_dir/___errors.txt
  if [ $? != 0 ]; then
    # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
    date > $download_dir/errors.txt
    cat $download_dir/___errors.txt >> $download_dir/errors.txt
    echo -n 'HTTP response: ' >> $download_dir/errors.txt
    cat $download_dir/___http_code.txt >> $download_dir/errors.txt
  else
    # strip index.html of unnecessary stuff
    grep -E '<img[^>]+alt="\[DIR\]">' $download_dir/___index.html > $download_dir/index.html

    if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
      # if no errors, save index.html to server_mock dir for local testing
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

    local states_filter="$(tr '\n' '|' <states-to-scrape.txt | sed -E -e 's/\|$//')"
    python3 $script_base_dir/get-project-year-and-state.py $download_dir/index.txt | grep -E "~$states_filter~" >$download_dir/index_with_year_and_state.txt
  else
    rm $download_dir/index_details.txt
  fi

  # get meta/laz/las directories
  grep -v '_' $download_dir/___dirs_and_details.txt >$download_dir/data_details.txt
  if [ $? = 0 ]; then
    grep -Eio '^meta(data)?~' $download_dir/data_details.txt 2>/dev/null | tr -d '~' > $download_dir/metadata_dir.txt
    if [ "$?" = 0 ]; then
      echo -n data > $download_dir/contents-type.txt
    else
      rm $download_dir/metadata_dir.txt
    fi
    grep -Eio '^la[zs]?~' $download_dir/data_details.txt 2>/dev/null | tr -d '~' >$download_dir/laz_dir.txt
    if [ "$?" = 0 ]; then
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
  local current_dir="$1"

  ### START DIFF/STATS
  local data_type=$(cat $backup_dir/contents-type.txt)
  ### MAKE STATS / DIFF with previous (currents)
  if [ -d $current_dir ]; then
    if [ "$data_type" = 'projects' ]; then
      # do diffs side-by-side
      diff --side-by-side $current_dir/index.txt $backup_dir/index.txt | tr -d '\t ' | grep -E '<$' | sed -E -e 's/<$//' >$backup_dir/diff-removed.txt
      diff --side-by-side $current_dir/index.txt $backup_dir/index.txt | tr -d '\t ' | grep -E '^>' | sed -E -e 's/^>//' >$backup_dir/diff-added.txt
      diff --side-by-side $current_dir/index_details.txt $backup_dir/index_details.txt | tr -d '\t ' | grep '|' >$backup_dir/diff-changed.txt
      if [ ! -s $backup_dir/diff-removed.txt ]; then rm $backup_dir/diff-removed.txt; fi
      if [ ! -s $backup_dir/diff-removed.txt ]; then rm $backup_dir/diff-added.txt; fi
      if [ ! -s $backup_dir/diff-removed.txt ]; then rm $backup_dir/diff-changed.txt; fi

      #    sed -E \
      #      -e 's/~20[0-9]{2}.+$//' \
      #      -e 's/^.*(20[0-9]{2}).*$/\1/' \
      #      -e '/20[0-9]/ !s/.+/unknown/' \
      #      $backup_dir/diff-removed.txt | sort | uniq >$backup_dir/diff/removed-years.txt
      #
      #    sed -E \
      #      -e 's/~20[0-9]{2}.+$//' \
      #      -e 's/.*(20[0-9]{2}).*/\1/' \
      #      -e '/20[0-9]/ !s/.+/unknown/' \
      #      $backup_dir/diff-added.txt | sort | uniq >$backup_dir/diff/added-years.txt

      echo -n > $backup_dir/diff.txt
      echo $(get_line_count $backup_dir/index.txt) total projects >$backup_dir/diff.txt
      echo $(get_line_count $current_dir/index.txt) old total projects >>$backup_dir/diff.txt
      echo $(get_line_count $backup_dir/diff-removed.txt) removed >>$backup_dir/diff.txt
      echo $(get_line_count $backup_dir/diff-added.txt) added >>$backup_dir/diff.txt
      echo $(get_line_count $backup_dir/diff-changed.txt) updated >>$backup_dir/diff.txt
      echo >>$backup_dir/diff.txt
    fi

   # diff on meta/laz dir details
    if [ "$data_type" = 'data' ]; then
      diff --side-by-side $current_dir/data_details.txt $backup_dir/data_details.txt | tr -d '\t ' | grep '|' > $backup_dir/diff/diff-changed.txt 2>/dev/null
      echo $(get_line_count $backup_dir/diff-changed.txt) meta/laz dirs updated >>$backup_dir/diff.txt
    fi
  else
    echo 'first time scraping' >$backup_dir/diff.txt
  fi
  ### END DIFF/STATS
}

scrape_index_helper__backup() {
  local backup_dir="$1"
  local current_dir="$1"

  if [ -d $current_dir ]; then
    rm -rf $current_dir
  fi
  cp -r $backup_dir $current_dir
}

if [ "$(basename $0)" = "scrape-index-helper.sh" ]; then
    if [ "$1" = 'main' ]; then
      scrape_index_helper $1
    elif [ "$1" = 'loop' ]; then
      scrape_index_helper $1
    fi
fi