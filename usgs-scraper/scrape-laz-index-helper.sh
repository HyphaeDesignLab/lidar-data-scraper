if [ ! "$___utils_sh_included" ]; then . ./utils.sh; fi
if [ ! "$___utils_stats_sh_included" ]; then . ./utils-stats.sh; fi

scrape_laz_index_helper() {
  local project="$1"
  local project_path="projects/$project"

  #backup_dir=backup/2023-05-29---15-56-46

  # Make a new back-up dir, download/parse new data into it
  local backup_dir=$project_path/laz/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)

  # Compare it to the current (about to become last-backup)
  local current_dir=$project_path/laz/_index/current

  # DOWNLOAD
  scrape_laz_index_helper__curl $project $backup_dir

  # Parse data out of index.html
  scrape_laz_index_helper__parse_index $project $backup_dir

  # Do diff with previous backup (aka current current)
  scrape_laz_index_helper__diff $backup_dir $current_dir

  # Backup: make new back-up => current
  scrape_laz_index_helper__backup $backup_dir $current_dir
}

scrape_laz_index_helper__curl() {
  local project="$1"
  local download_dir="$2"
  mkdir -p $download_dir

  local laz_url_dir=$(cat $project_path/_index/current/laz_dir.txt)

  local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/
  if [ "$LIDAR_SCRAPER_DEBUG__MOCK_SERVER" != '' ]; then
    base_url=$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS
    echo_if_debug "scrape-laz-index-helper.sh: mock server in use: $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS"
  fi

  curl_scrape $base_url/$project/$laz_url_dir/ $download_dir/index.html $download_dir/___http_code.txt $download_dir/___errors.txt
  if [ $? != 0 ]; then
    # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
    date > $download_dir/errors.txt
    cat $download_dir/___errors.txt >> $download_dir/errors.txt
    echo -n 'HTTP response: ' >> $download_dir/errors.txt
    cat $download_dir/___http_code.txt >> $download_dir/errors.txt
  else
    # if no errors
    if [ "$LIDAR_SCRAPER_DEBUG__MOCK_SERVER" = '' ]; then
      # if not debugging, save index.html to server_mock dir for local testing
      mkdir -p projects/_server_mock/$project/$laz_url_dir/
      cp $download_dir/index.html projects/_server_mock/$project/$laz_url_dir/index.html
    fi
  fi
  # remove temporary files
  rm $download_dir/___*
}

scrape_laz_index_helper__is_not_started() {
  local project="$1"
  local project_path="projects/$project"
  if [ ! -d $project_path/laz/_index/current/ ] \
      || [ ! -f $project_path/laz/_index/current/index.html ] \
      || [ ! -f $project_path/laz/_index/current/files.txt ]; then
        return 0
  fi
  return 1
}
scrape_laz_index_helper__has_been_updated_on_server() {
  local project="$1"
  local project_path="projects/$project"

  if grep "^$(cat $project_path/_index/current/laz_dir.txt)~" $project_path/_index/current/diff-updated.txt 2>/dev/null >/dev/null; then
    return 0
  else
    return 1
  fi
}

scrape_laz_index_helper__parse_index() {
  local project="$1"
  local download_dir="$2"

  local project_name=$(cut -d'/' -f 1 <<< $project); # get the project text before '/'
  local subproject_name=$(cut -d'/' -f 2 <<< $project); # get the subproject (text after a slash /)
  if [ "$subproject_name" = '' ]; then subproject_name='zzzzzzzzzz____nonexistent_string'; fi; # subproject is used for text replacement below, so if NOT SET, set it to something that cannot possibly exist in a filename

  grep -iE '<a href="([^"]+).la[sz]">' $download_dir/index.html > $download_dir/___files_details.txt;
  if [ $? = 0 ]; then
    sed -E \
    -e 's@^.+<a href="([^"]+).la[sz]">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
    -e 's@/@@' \
    -e "s/USGS_LPC_/{u}/" \
    -e "s@$project_name@{prj}@" \
    -e "s@$subproject_name@{sprj}@" \
    $download_dir/___files_details.txt > $download_dir/files_details.txt;

    grep -Eo '^[^~]+' $download_dir/files_details.txt > $download_dir/files.txt;
  fi

  # remove temporary files
  rm $download_dir/___*
}

scrape_laz_index_helper__diff() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  ### START DIFF/STATS
  ### MAKE STATS / DIFF with previous (currents)
  if [ -d $current_dir ]; then
    # diff on laz index
    if [ -f $backup_dir/files_details.txt ]; then
      python3 diff_file_list.py $current_dir/files_details.txt $backup_dir/files_details.txt $backup_dir/
    fi

    # diff on zip files
    if [ -f $backup_dir/zip_files_details.txt ]; then
      python3 diff_file_list.py $current_dir/zip_files_details.txt $backup_dir/zip_files_details.txt $backup_dir/
    fi
  else
    echo 'first time scraping' > $backup_dir/diff.txt
  fi
  ### END DIFF/STATS
}

scrape_laz_index_helper__backup() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  if [ -d $current_dir ]; then
    rm -rf $current_dir
  fi
  cp -r $backup_dir $current_dir
}

if [ "$(basename $0)" = "scrape-laz-index-helper.sh" ]; then
    if [ "$1" = 'main' ]; then
      scrape_laz_index_helper $2
    elif [ "$1" = 'loop' ]; then
      if [ ! "$2" ] || [ ! "$3" ] || [ ! "$4" ]; then
        echo ' call the "loop" tester with 5 arguments'
        echo '   1="loop" to invoke the tester'
        echo '   2=callback_function_to_test and call for every loop '
        echo '       possible value: '
        echo '          get           => get from URL  (scrape_laz_index_helper__curl)'
        echo '          parse         => parse index  (scrape_laz_index_helper__parse_index)'
        echo '          diff          => diff the previous and current index (scrape_laz_index_helper__diff)'
        echo '          backup        => backup the current (scrape_laz_index_helper__backup)'
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
          loop_on_projects $___lidar_scrape_project scrape_laz_index_helper__curl $4 $5 $6
        elif [ "$2" = 'parse' ]; then
          loop_on_projects $___lidar_scrape_project scrape_laz_index_helper__parse_index $4 $5 $6
        elif [ "$2" = 'diff' ]; then
          loop_on_projects $___lidar_scrape_project scrape_laz_index_helper__diff $4 $5 $6
        elif [ "$2" = 'backup' ]; then
          loop_on_projects $___lidar_scrape_project scrape_laz_index_helper__backup $4 $5 $6
        fi
      fi
    else
      eval $1 $2 $3 $4 $5 $6
    fi
fi