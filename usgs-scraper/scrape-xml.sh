#!/bin/bash

cd $(dirname $0)
if [ ! "$___utils_sh_included" ]; then . ./utils.sh; fi
if [ ! "$___utils_stats_sh_included" ]; then . ./utils-stats.sh; fi

. ./scrape-meta-index-helper.sh

scrape_xml_files() {
  if check_stop_scrape; then return; fi

  local project="$1"
  local xml_files_path="projects/$project/meta/_index/current/xml_files.txt"

  if [ ! -d "projects/$project" ]; then return 6; fi
  if [ ! -f "$xml_files_path" ]; then return 8; fi

  local xml_files=$(cat $xml_files_path)

  local xml_file_i='0'
  local xml_file_count=$(cat $xml_files_path | wc -l | tr -d ' ')
  local xml_file=''
  for xml_file in $xml_files; do
    if check_stop_scrape; then break; fi

    ((xml_file_i++))
    local echo_out="$(date +'%H:%M:%S'): downloading xml $xml_file_i/$xml_file_count: $xml_file"
    printf "\r%*s\r$echo_out" ${#echo_out}

    scrape_xml_file $project $xml_file
  done
}

scrape_xml_file() {
  if check_stop_scrape; then return; fi

  local project_path="$1"
  local project=$(cut -d/ -f1 <<< "$project_path")
  local subproject=$(cut -d/ -f2 <<< "$project_path")
  local xml_file_abbr_noext="$2"

  local meta_dir="projects/$project_path/meta"
  local url_meta_dir="$(cat projects/$project_path/_index/current/metadata_dir.txt | tr -d '\n')"

  local xml_file_noext=$(sed -e 's/{u}/USGS_LPC_/' -e "s@{prj}@$project@" -e "s@{sprj}@$subproject@" <<< "$xml_file_abbr_noext")
  local xml_file="$xml_file_noext.xml"

  local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects

  if [ ! -s $meta_dir/$xml_file ]; then
    throttle_scrape 250/60 50/20
    ### DOWNLOAD
    local url=$base_url/$project_path/$url_meta_dir/$xml_file
    rm $meta_dir/$xml_file.error 2>/dev/null
    curl_scrape $url $meta_dir/$xml_file $meta_dir/$xml_file.httpcode $meta_dir/$xml_file.error
    if [ $? != 0 ]; then
      rm $meta_dir/$xml_file
      # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
      echo -n 'HTTP response: ' >> $meta_dir/$xml_file.error
      cat $meta_dir/$xml_file.httpcode >> $meta_dir/$xml_file.error
      rm $meta_dir/$xml_file.httpcode

    else
      rm $meta_dir/$xml_file.error 2>/dev/null
      rm $meta_dir/$xml_file.httpcode 2>/dev/null
      extract_xml_data_of_single_file $meta_dir $xml_file_noext
    fi
  else
    extract_xml_data_of_single_file $meta_dir $xml_file_noext
  fi
}
extract_xml_files_data() {
  if check_stop_scrape; then return; fi

  local project="$1"

  local meta_dir="projects/$project/meta/"
  local fff=''
  local _count=0;
  local _total=$(find $meta_dir -name '*.xml' -type f | wc -l)
  for fff in $meta_dir/*.xml; do
    if check_stop_scrape; then break; fi

    # by default print text status compactly (only the last line, overwrite previous lines)
    if [ "$LIDAR_SCRAPER_COMPACT_TEXT_STATUS" = 0 ]; then
      echo "$_count / $_total processing";
    else
      printf "\r%*s\r" "$(tput cols)" " "
      echo -n "$_count / $_total processing"
    fi
    ((_count++))
    extract_xml_data_of_single_file $meta_dir $(echo $fff | sed -E -e 's@^.+/@@;s/\.xml$//')
  done
}
extract_xml_data_of_single_file() {
  if check_stop_scrape; then return; fi

  local dir=$1
  local xml_file=$2
  grep -E '' $dir/$xml_file.xml |
    sed -E -e '
      /<(begdate|enddate|westbc|eastbc|northbc|southbc|mapprojn)>/ ! d
      s/^ +//
      s/^<begdate> */date_start:/
      s/^<enddate> */date_end:/
      s/^<([a-z]+)bc> */\1:/
      s/^<mapprojn> */map_proj:/
      /<mapprojn>/ {
        s/^/map_proj:/
        b skip_tag_remove
      }
      s@</?[^>]+>@@g
      :skip_tag_remove
      /^ *$/ d
    ' \
    > $dir/$xml_file.xml.txt
}

if [ "$1" = 'project_xml_files' ]; then
  scrape_xml_files $2 $3
elif [ "$1" = 'project_xml_file' ]; then
  scrape_xml_file $2 $3 $4
elif [ "$1" = 'project_xmls_data' ]; then
  extract_xml_files_data $2 $3
elif [ "$1" = 'extract_xml_data_of_single_file' ]; then
  extract_xml_data_of_single_file $2 $3
elif [ "$1" != "" ]; then
  scrape_xml $1;
fi
