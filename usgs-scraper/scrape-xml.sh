#!/bin/bash
base_dir=$(dirname $0)
cd $base_dir
. ./utils-stats.sh
. ./scrape-project-meta.sh

scrape_count=0
echo > scrape-rest.txt;
check_xml_scrape_count_and_rest() {
    ((scrape_count++))

    date >> scrape-rest.txt;
    if [ "$(expr $scrape_count % 250)" = "0" ]; then
        echo 'every 250 scrapes rest 60 seconds' >> scrape-rest.txt;
        sleep 50
    elif [ "$(expr $scrape_count % 50)" = "0" ]; then
        echo 'every 50 scrapes rest 20 seconds' >> scrape-rest.txt;
        sleep 10
    else
        sleep .2
    fi
}

scrape_project_xml() {
    project=$1
    local project_path="$project"
    is_in_loop=$2

    if [ ! "$is_in_loop" ]; then
        echo -n "(prj) $project: "
    fi

    subprojects=$(started_scrape $project)
    subprojects_count=$(started_scrape $project | wc -l)
    if [ "$subprojects" ]; then
        subproject_i=0
        for subproject in $subprojects; do
            subproject_i=$(expr $subproject_i + 1)
            echo -n "(subprj) $subproject ($subproject_i/$subprojects_count): "
            scrape_subproject_xml $project $subproject in_loop
        done;
    else
        if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
            echo " metadata scraping";
            scrape_project_xml_files $project
        else
            echo " NO metadata to scrape";
        fi
    fi
    project_info $project > projects/$project_path/_stats.txt
}

scrape_subproject_xml() {
    project=$1
    subproject=$2
    is_in_loop=$3
    local project_path="$project/$subproject"

    if [ ! "$is_in_loop" ]; then
        echo -n "(subprj) $project: $subproject: "
    fi

    if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
        echo " metadata scraping";
        scrape_project_xml_files $project $subproject
    else
        echo " metadata already scraped";
    fi
    project_info $project $subproject > projects/$project_path/_stats.txt
}


scrape_projects_xml() {

    echo "scraping projects XML files";

    projects=$(started_scrape)
    projects_count=$(started_scrape | wc -l)

    project_i=0
    for project in $projects; do
        if [ -f projects/STOP_SCRAPE.txt ]; then break; fi;

        project_line=$(grep "${project}~" projects/_index/current/index_with_year_and_state.txt)
        project_state=$(echo $project_line | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

        # skip states that are NOT in STATES to SCRAPE
        if  [ "$project_state" ] && [ "$project_state" != "none" ] && [ "$(grep $project_state states-to-scrape.txt)" = "" ]; then
            continue
        fi

        project_i=$(expr $project_i + 1)
        echo -n "(prj) $project ($project_i/$projects_count): "
        scrape_project_xml $project in_loop
    done
    if [ -f projects/STOP_SCRAPE.txt ]; then
      rm projects/STOP_SCRAPE.txt
    fi;
}

scrape_project_xml_files() {
  local project_path="projects"
  project="$1"
  subproject="$2"
  if [ $project ]; then
    project_path="projects/$project"
  fi
  if [ $subproject ]; then
    project_path="projects/$project/$subproject"
  fi

  meta_dir=$project_path/meta

  local project_path_url=""
  if [ $project ]; then
    project_path_url="$project/"
  fi
  if [ $subproject ]; then
    project_path_url="$project/$subproject/"
  fi

  if [ "$ZENV_SAMPLE_XML_ONLY" ]; then
    xml_files_count=$(get_line_count $meta_dir/xml_files.txt)
    xml_files_middle_i=$(expr $xml_files_count / 2)
  fi;
  xml_files=$(sed -e 's/{u}/USGS_LPC_/' -e "s/{prj}/$project/" $meta_dir/xml_files.txt 2>/dev/null)

  xml_file_i='0'
  for xml_file in $xml_files; do
    if [ "$ZENV_SAMPLE_XML_ONLY" ]; then
      ((xml_file_i++))
    fi;
    if [ "$ZENV_SAMPLE_XML_ONLY" ] && [ "$xml_file_i" != '1' ] && [ "$xml_file_i" != "$xml_files_count" ] && [ "$xml_file_i" != "$xml_files_middle_i" ]; then
      continue;
    fi
    scrape_project_xml_file $meta_dir $project_path_url $xml_file
    if [ -f projects/STOP_SCRAPE.txt ]; then break; fi;
  done
  if [ -f projects/STOP_SCRAPE.txt ]; then
    rm projects/STOP_SCRAPE.txt
  fi;
}

scrape_project_xml_file() {
  meta_dir=$1
  local project_path_url=$2
  xml_file=$3

  # do not scrape if TXT info already extracted or XML is downloaded or has started scrape
  if [ -f $meta_dir/$xml_file.xml.scraping ]; then
    return;
  fi

  if [ ! -f $meta_dir/$xml_file.xml ]; then
    echo > $meta_dir/$xml_file.xml.scraping # mark as "started scraping" for other threads or scrapers
    check_xml_scrape_count_and_rest
    ### DOWNLOAD
    base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    url=$base_url/$project_path_url/metadata/$xml_file.xml
    curl -s -S --retry 4 --retry-connrefused $url 2>$meta_dir/__errors.txt >$meta_dir/$xml_file.xml
    if [ "$(grep '404 Not Found' $meta_dir/$xml_file.xml)" ]; then
      echo '404 not found' >>$meta_dir/__errors.txt
    fi
    if [ $(get_line_count_or_empty $meta_dir/__errors.txt) ]; then
      echo $(date) $(cat $meta_dir/__errors.txt) >>$meta_dir/_errors.txt
    else
      extract_xml_data $meta_dir $xml_file
    fi
    rm $meta_dir/__errors.txt
    rm $meta_dir/$xml_file.xml.scraping  # remove marker file
  else
    extract_xml_data $meta_dir $xml_file
  fi
}

extract_xml_data() {
  dir=$1
  xml_file=$2
  grep -E '' $dir/$xml_file.xml |
    sed -E -e '
      /<(begdate|enddate|westbc|eastbc|northbc|southbc|mapprojn)>/ ! d
      s/^ +//
      s/^<begdate> */date_start:/
      s/^<enddate> */date_end:/
      s/^<(\w+)bc> */\1:/
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

if [ "$1" = "all" ]; then
  scrape_projects_xml;
elif [ "$1" = 'xml' ]; then
  scrape_project_meta_xml $2 $3
elif [ "$1" = 'xml_extract_data' ]; then
  extract_xml_data $2 $3
elif [ "$1" != "" ]; then
    if [ "$2" = "" ]; then
        scrape_project_xml $1;
    else
        scrape_subproject_xml $1 $2;
    fi
fi