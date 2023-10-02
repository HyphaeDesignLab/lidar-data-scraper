. ./utils.sh
. ./utils-stats.sh

scrape_meta_index_helper() {
  local project="$1"
  local project_path="projects"
  if [ $project ]; then
    project_path="projects/$project"
  fi

  #backup_dir=backup/2023-05-29---15-56-46

  # Make a new back-up dir, download/parse new data into it
  local backup_dir=$project_path/meta/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)

  # Compare it to the current (about to become last-backup)
  local current_dir=$project_path/meta/_index/current

  # DOWNLOAD
  scrape_meta_index_helper__curl $project $backup_dir

  # Parse data out of index.html
  scrape_meta_index_helper__parse_index $project $backup_dir

  # Do diff with previous backup (aka current current)
  scrape_meta_index_helper__diff $backup_dir $current_dir

  # Backup: make new back-up => current
  scrape_meta_index_helper__backup $backup_dir $current_dir
}

scrape_meta_index_helper__curl() {
  local project="$1"
  local download_dir="$2"
  mkdir -p $download_dir

  local meta_url_dir=$(cat $project_path/_index/current/metadata_dir.txt)

  local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/
  if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
    base_url=$LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS
    echo_if_debug "scrape-index-helper.sh: mock server in use: $LIDAR_SCRAPER_DEBUG__MOCK_SERVER_ADDRESS"
  fi

  curl_scrape $base_url/$project/$meta_url_dir/index.html $download_dir/index.html $download_dir/___http_code.txt $download_dir/___errors.txt
  if [ $? != 0 ]; then
    # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
    date > $download_dir/errors.txt
    cat $download_dir/___errors.txt >> $download_dir/errors.txt
    echo -n 'HTTP response: ' >> $download_dir/errors.txt
    cat $download_dir/___http_code.txt >> $download_dir/errors.txt
  else
    # if no errors
    if [ "$LIDAR_SCRAPER_DEBUG" = '' ]; then
      # if not debugging, save index.html to server_mock dir for local testing
      mkdir -p projects/_server_mock/$project/$meta_url_dir/
      cp $download_dir/index.html projects/_server_mock/$project/$meta_url_dir/index.html
    fi
  fi
  # remove temporary files
  rm $download_dir/___*
}

scrape_meta_index_helper__parse_index() {
  local project="$1"
  local download_dir="$2"

  # get meta file name, last modified, and size out of HTML
  # get ZIP file name if it exists, last modified, and size out of HTML
  #    skip (d=delete) all lines that are not DIR
  #    get the href PATH and the YYYY-MM-DD HH:MM timestamp and -/12K/1.2M/200M file size
  #    finally remove slashes in href PATH and trailing - (i.e. missing/not-applicable file size)
  grep -oE '<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">' $download_dir/index.html > $download_dir/___zip_files_details.txt
  if [ $? = 0 ]; then
    sed -E -e 's@.*<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
     $download_dir/___zip_files_details.txt > $download_dir/zip_files_details.txt;

     grep -Eo '^[^~]+' $download_dir/zip_files_details.txt > $download_dir/zip_files.txt;
  fi


  local project_name=$(cut -d'/' -f 1 <<< $project); # get the project text before '/'
  local subproject_name=$(cut -d'/' -f 2 <<< $project); # get the subproject (text after a slash /)
  if [ "$subproject_name" = '' ]; then subproject_name='zzzzzzzzzz____nonexistent_string'; fi; # subproject is used for text replacement below, so if NOT SET, set it to something that cannot possibly exist in a filename

  grep -E '<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">' $download_dir/index.html > $download_dir/___xml_files_details.txt;
  if [ $? = 0 ]; then
    sed -E \
    -e 's@<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
    -e 's@/@@' \
    -e "s/USGS_LPC_/{u}/" \
    -e "s@$project_name@{prj}@" \
    -e "s@$subproject_name@{sprj}@" \
    $download_dir/___xml_files_details.txt > $download_dir/xml_files_details.txt;

    grep -Eo '^[^~]+' $download_dir/xml_files_details.txt > $download_dir/xml_files.txt;
  fi

  # remove temporary files
  rm $download_dir/___*
}

scrape_meta_index_helper__diff() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  ### START DIFF/STATS
  local data_type=$(cat $backup_dir/contents-type.txt)
  ### MAKE STATS / DIFF with previous (currents)
  if [ -d $current_dir ]; then
    # diff on xml (meta) index
    if [ -f $backup_dir/xml_files_details.txt ]; then
      python3 diff_file_list.py $current_dir/xml_files_details.txt $backup_dir/xml_files_details.txt $backup_dir/
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

scrape_meta_index_helper__backup() {
  local backup_dir="$1"
  local current_dir="$backup_dir/../../current"

  if [ -d $current_dir ]; then
    rm -rf $current_dir
  fi
  cp -r $backup_dir $current_dir
}

if [ "$(basename $0)" = "scrape-meta-index-helper.sh" ]; then
    if [ "$1" = 'main' ]; then
      scrape_meta_index_helper $1
    elif [ "$1" = 'loop' ]; then
      if [ ! "$2" ] || [ ! "$3" ] || [ ! "$4" ]; then
        echo ' call the "loop" tester with 5 arguments'
        echo '   1="loop" to invoke the tester'
        echo '   2=callback_function_to_test and call for every loop '
        echo '       possible value: '
        echo '          get           => get from URL  (scrape_meta_index_helper__curl)'
        echo '          parse         => parse index  (scrape_meta_index_helper__parse_index)'
        echo '          diff          => diff the previous and current index (scrape_meta_index_helper__diff)'
        echo '          backup        => backup the current (scrape_meta_index_helper__backup)'
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
          loop_on_projects $___lidar_scrape_project scrape_meta_index_helper__curl $4 $5 $6
        elif [ "$2" = 'parse' ]; then
          loop_on_projects $___lidar_scrape_project scrape_meta_index_helper__parse_index $4 $5 $6
        elif [ "$2" = 'diff' ]; then
          loop_on_projects $___lidar_scrape_project scrape_meta_index_helper__diff $4 $5 $6
        elif [ "$2" = 'backup' ]; then
          loop_on_projects $___lidar_scrape_project scrape_meta_index_helper__backup $4 $5 $6
        fi
      fi
    fi
fi