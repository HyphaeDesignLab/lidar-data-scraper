cd $(dirname $0)
if [ ! "$___utils_sh_included" ]; then . ./utils.sh; fi
if [ ! "$___utils_stats_sh_included" ]; then . ./utils-stats.sh; fi

. ./scrape-meta-index-helper.sh

scrape_xml() {
    if check_stop_scrape; then return; fi

    local project=$1
    local project_path="$project"
    local is_in_loop=$2

    if [ ! "$is_in_loop" ]; then
        echo -n "(prj) $project: "
    fi

    local subprojects=$(started_scrape $project)
    local subprojects_count=$(started_scrape $project | wc -l)
    if [ "$subprojects" ]; then
        local subproject_i=0
        local subproject=''
        for subproject in $subprojects; do
            if check_stop_scrape; then break; fi

            subproject_i=$(expr $subproject_i + 1)
            echo -n "(subprj) $subproject ($subproject_i/$subprojects_count): "
            scrape_xml_2 $project $subproject in_loop
        done;
    else
        if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
            echo " metadata scraping";
            scrape_xml_files $project
        else
            echo " NO metadata to scrape";
        fi
    fi
    project_info $project > projects/$project_path/_stats.txt
}

scrape_xml_2() {
    if check_stop_scrape; then return ; fi

    local project=$1
    local subproject=$2
    local is_in_loop=$3
    local project_path="$project/$subproject"

    if [ ! "$is_in_loop" ]; then
        echo -n "(subprj) $project: $subproject: "
    fi

    if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
        echo " metadata scraping";
        scrape_xml_files $project $subproject
    else
        echo " metadata already scraped";
    fi
    project_info $project $subproject > projects/$project_path/_stats.txt
}


scrape_xml_all() {
    if check_stop_scrape; then return; fi

    echo "scraping projects XML files";

    local projects=$(started_scrape)
    local projects_count=$(started_scrape | wc -l)

    local project_i=0
    local project=''
    for project in $projects; do
        if check_stop_scrape; then break; fi

        local project_line=$(grep "${project}~" projects/_index/current/index_with_year_and_state.txt)
        local project_state=$(echo $project_line | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

        # skip states that are NOT in STATES to SCRAPE
        if  [ "$project_state" ] && [ "$project_state" != "none" ] && [ "$(grep $project_state states-to-scrape.txt)" = "" ]; then
            continue
        fi

        ((project_i++))
        echo -n "(prj) $project ($project_i/$projects_count): "
        scrape_xml $project in_loop
    done
}

scrape_xml_files() {
  if check_stop_scrape; then return; fi

  local project_path="projects"
  local project="$1"
  local subproject="$2"
  if [ $project ]; then
    project_path="projects/$project"
  fi
  if [ $subproject ]; then
    project_path="projects/$project/$subproject"
  fi

  local meta_dir=$project_path/meta

  local project_path_url=""
  if [ $project ]; then
    project_path_url="$project/"
  fi
  if [ $subproject ]; then
    project_path_url="$project/$subproject/"
  fi

  if [ "$ZENV_SAMPLE_XML_ONLY" ]; then
    local xml_files_count=$(get_line_count $meta_dir/_index/current/xml_files.txt)
    local xml_files_middle_i=$(expr $xml_files_count / 2)
  fi;
  local xml_files=$(sed \
   -e 's/{u}/USGS_LPC_/' \
   -e "s/{prj}/$project/" \
   -e "s/{sprj}/$subproject/" \
   $meta_dir/_index/current/xml_files.txt)

  local xml_file_i='0'
  local xml_file=''
  for xml_file in $xml_files; do
    if check_stop_scrape; then break; fi

    if [ "$ZENV_SAMPLE_XML_ONLY" ]; then
      ((xml_file_i++))
    fi;
    if [ "$ZENV_SAMPLE_XML_ONLY" ] && [ "$xml_file_i" != '1' ] && [ "$xml_file_i" != "$xml_files_count" ] && [ "$xml_file_i" != "$xml_files_middle_i" ]; then
      continue;
    fi
    scrape_xml_file $meta_dir $project_path_url $xml_file
  done
}

scrape_xml_file() {
  if check_stop_scrape; then return; fi

  local meta_dir=$1
  local project_path_url=$2
  local xml_file=$3

  if [ ! -f $meta_dir/$xml_file.xml ]; then
    throttle_scrape 250/60 50/20
    ### DOWNLOAD
    local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    local url=$base_url/$project_path_url/metadata/$xml_file.xml
    rm $meta_dir/$xml_file.xml.error 2>/dev/null
    curl_scrape $url $meta_dir/$xml_file.xml $meta_dir/$xml_file.xml.httpcode $meta_dir/$xml_file.xml.error
    if [ $? != 0 ]; then
      rm $meta_dir/$xml_file.xml
      # save more detailed error to errors.txt (only 1 request (index.html) error we are dealing with here)
      echo -n 'HTTP response: ' >> $meta_dir/$xml_file.xml.error
      cat $meta_dir/$xml_file.xml.httpcode >> $meta_dir/$xml_file.xml.error
      rm $meta_dir/$xml_file.xml.httpcode

    else
      rm $meta_dir/$xml_file.xml.error 2>/dev/null
      rm $meta_dir/$xml_file.xml.httpcode 2>/dev/null
      extract_xml_data_of_single_file $meta_dir $xml_file
    fi
  else
    extract_xml_data_of_single_file $meta_dir $xml_file
  fi
}
extract_xml_data() {
  if check_stop_scrape; then return; fi

  local project_path="projects"
  local project="$1"
  local subproject="$2"
  if [ $project ]; then
    project_path="projects/$project"
  fi
  if [ $subproject ]; then
    project_path="projects/$project/$subproject"
  fi

  local meta_dir=$project_path/meta
  local fff=''
  local _count=0;
  local _total=$(find $meta_dir -name '*.xml' -type f | wc -l)
  for fff in $meta_dir/*.xml; do
    if check_stop_scrape; then break; fi

    printf "\r%*s\r" "$(tput cols)" " "
    echo -n "$_count / $_total processing"
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

if [ "$1" = "all-project" ]; then
  scrape_xml_all;
elif [ "$1" = 'project' ]; then
  scrape_xml_files $2 $3
elif [ "$1" = 'xml_extract_data' ]; then
  extract_xml_data $2 $3
elif [ "$1" = 'extract_xml_data_of_single_file' ]; then
  extract_xml_data_of_single_file $2 $3
elif [ "$1" != "" ]; then
    if [ "$2" = "" ]; then
        scrape_xml $1;
    else
        scrape_xml_2 $1 $2;
    fi
fi