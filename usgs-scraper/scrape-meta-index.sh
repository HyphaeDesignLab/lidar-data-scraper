. ./utils-stats.sh

scrape_meta_index() {
    local project_path="projects/$project"
    local meta_dir=$project_path/meta
    local backup_dir=$meta_dir/_backup/$(date +%Y-%m-%d---%H-%M-%S)
    mkdir -p $backup_dir
    local current_dir=$meta_dir/_current/

    local project_name=$(cut -d'/' -f 1 <<< $project); # get the project text before '/'
    local subproject_name=$(cut -d'/' -f 2 <<< $project); # get the subproject (text after a slash /)
    if [ "$subproject_name" = '' ]; then subproject_name='zzzzzzzzzz____nonexistent_string'; fi; # subproject is used for text replacement below, so if NOT SET, set it to something that cannot possibly exist in a filename

    # introducing new meta directory structure:
    # START: post-factum set-up of _current and _backup
    #   meta/_current/ where all non XML and non .TXT.XML files live
    #   meta/_backup/<backup_datestamp> folder lives of past scrapes (copies of previous _current folders)
    # if we never did a backup and no current dir, migrate all files from main meta/dir to _current
    if [ ! -d $current_dir ]; then
      mkdir -p $current_dir # make current dir

      # grab last-mod time from meta dir itself
      local meta_dir_last_mod_in_seconds=$(stat -c '%Y' $meta_dir 2>/dev/null)
      if [ "$meta_dir_last_mod_in_seconds" = '' ]; then
        # alternate usage of stat
        meta_dir_last_mod_in_seconds=$(stat -f "%m" -t "%s" $meta_dir)
      fi
      local previous_backup_date=$(date --date="@$meta_dir_last_mod_in_seconds" '+%Y-%m-%d---%H-%M-%S' 2>/dev/null)
      if [ "$previous_backup_date" = '' ]; then
        # if date utility does not work with the "--date" arg, try '-r'
        previous_backup_date=$(date -r "$meta_dir_last_mod_in_seconds" '+%Y-%m-%d---%H-%M-%S' 2>/dev/null)
      fi

      # copy all non .XML and non .TXT.XML files to new current dir
      for fff in _errors.txt _index.html xml_files.txt xml_files_details.txt zip_files.txt project-length-days.txt; do
        if [ -f $meta_dir/$fff ]; then
          cp $meta_dir/$fff $current_dir/$fff 2>/dev/null
        else
          echo > $current_dir/$fff
        fi
      done
      # do a back-up of current to previous (non-existent until now) backup
      cp -rf $current_dir $meta_dir/_backup/$previous_backup_date
    fi
    #/ END: post-factum set-up of _current and _backup

    local meta_url_dir=$(cat $project_path/_index/current/metadata_dir.txt)

    ### DOWNLOAD
    local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    # make sure there is a trailing, else USGS server 301-http-redirects
    local url=$base_url/$project/$meta_url_dir/
    curl -s -S --retry 4 --retry-connrefused $url 2> $backup_dir/__errors.txt > $backup_dir/_index.html
    if [ "$(grep '404 Not Found' $backup_dir/_index.html)" ]; then
      echo '404 not found' >> $backup_dir/__errors.txt
    fi
    if [ $(get_line_count_or_empty $backup_dir/__errors.txt) ]; then
        date | xargs echo -n >> $backup_dir/_errors.txt
        cat $backup_dir/__errors.txt >> $backup_dir/_errors.txt
    fi
    rm $backup_dir/__errors.txt

    grep -E '<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">' $backup_dir/_index.html |
     sed -E -e 's@<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">.+@\1@' \
     > $backup_dir/zip_files.txt

    grep -E '<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">' $backup_dir/_index.html |
     sed -E \
      -e 's@<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
      -e 's@/@@' \
      -e "s/USGS_LPC_/{u}/" \
      -e "s@$project_name@{prj}@" \
      -e "s@$subproject_name@{sprj}@" \
      > $backup_dir/xml_files_details.txt

    grep -Eo '^[^~]+' $backup_dir/xml_files_details.txt > $backup_dir/xml_files.txt

    # get XML file remove, added and date/size difference
    # compare only file names (in xml_files.txt)
    #   whether xml file was there but IS NOT NOW OR was not there but IS NOW
    diff --side-by-side $current_dir/xml_files.txt $backup_dir/xml_files.txt | tr -d '\t ' | grep -E '<$' | sed -E -e 's/<$//' > $backup_dir/removed.txt
    diff --side-by-side $current_dir/xml_files.txt $backup_dir/xml_files.txt | tr -d '\t ' | grep -E '^>' | sed -E -e 's/^>//' > $backup_dir/added.txt
    # last-mod date and file size differences live in xml_files_details.txt
    diff --side-by-side $current_dir/xml_files_details.txt $backup_dir/xml_files_details.txt | tr -d '\t ' | grep '|' > $backup_dir/changes.txt

    # copy current backup as the "current"
    cp -rf $backup_dir $current_dir
}

xml_check_empty_or_not_found() {
  if [ -s $1 ]; then
    grep -HF '404 Not Found' $1 | sed 's/404 Not Found/not_found/';
  else
    echo $1:empty
  fi;
}
xml_file_list() {
  find projects/ -type f -path '*/meta/*' -name '*.xml'
}
scrape_meta_check_empty() {
  if [ ! "$1" ]; then
    echo "to check all files and then do counts: $0 check_empty filein fileout"
    echo " OR"
    echo "to ONLY show counts: $0  check_empty file"
    return 1
  fi

  filein=$1
  fileout=$2
  if [ "$2" ]; then
    if [ ! -f $filein ]; then
      xml_file_list > $filein
    fi;
    while read -r line; do xml_check_empty_or_not_found $line; done < $filein > $fileout
  else
    fileout=$1
  fi

  if [ ! -f $fileout ]; then
    echo "no such file $fileout";
    return;
  fi;

  echo -n 'not found: ';
  grep -c 'not_found$' $fileout;

  echo -n 'empty: ';
  grep -c 'empty$' $fileout;
}
check_missing_projects() {
  if [ ! "$1" ] || [ ! "$2" ]; then
    echo "$0 check_missing_projects <project_list_file> <status_file_name>";
    echo " where <status_file_name> and <status_file_name>.error will be saved to each <project>/meta/ dir when requesting usgs.gov/<prj>/meta/index.html"
    return 1;
  fi
  for prj in $(cat $1); do
    curl -s -S --retry 4 --retry-connrefused https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/$prj/metadata/ 2>projects/$prj/meta/$2.error 1>projects/$prj/meta/$2
    sleep .5
  done

  for prj in $(cat $1); do
    grep -HF '404 Not Found' projects/$1/meta/$2
  done
}

if [ "$(basename $0)" = "scrape-meta-index.sh" ]; then
  if [ ! "$1" ]; then
    echo "to scrape all meta files: $0 all|<project> <?subproject>"
    echo " OR"
    echo "to check if empty meta files: $0  check_empty ..."
    echo "to check projects that have been taken offline: $0  check_missing_projects ..."
    exit;
  fi
  if [ "$1" = "check_empty" ]; then
    scrape_meta_check_empty $2 $3
  elif [ "$1" = "check_missing_projects" ]; then
    check_missing_projects $2 $3
  else
    scrape_meta_index $1
  fi
fi