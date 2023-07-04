base_dir=$(dirname $0)

. ./utils.sh
init_has_arg $@

base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects

started_scrape() {
    projects_path=projects
    if [ "$1" ]; then
        projects_path=projects/$project
    fi
    # find returns a list of dirs ending on /
    find $projects_path -mindepth 1 -maxdepth 1 -type d ! -name '_index' ! -name 'meta' | sed -e "s@$projects_path/@@" | sort;
}
started_scrape_with_subprojects() {
  find projects/ -mindepth 1 -maxdepth 2 -type d ! -name '_index' ! -name 'meta' ! -name 'backup' ! -name 'current' | sed -E -e "s@^.+/@@" | sort;
}

project_index() {
    projects_path=projects
    if [ "$1" ]; then
        projects_path=projects/$project
    fi

    cat $projects_path/_index/current/index.txt | grep -v '^$' | sort
}
index_bad_chars() {
    grep '[^0-9a-zA-Z_\-]' projects/_index/current/index.txt | sort
}

not_started_scrape() {
    for project in $(project_index); do
        if [ ! -d projects/$project ]; then
            echo $project;
        fi
    done
}

started_scrape_not_in_index() {
    started_scrape_out=__tmp_project_dirs_$(date +%s).txt
    started_scrape > $started_scrape_out

    index_out=__tmp_project_index_$(date +%s).txt
    project_index > $index_out

    diff_out=__tmp_diff$(date +%s).txt
    diff $started_scrape_out $index_out > $diff_out
    not_in_index=$(grep '^< ' $diff_out | cut -c '3-')
    for project in $not_in_index; do
        echo $project
        if [ "$1" = "remove_dirs" ]; then
            rm -rf projects/$project
        fi
    done

    rm $index_out
    rm $started_scrape_out
    rm $diff_out
}
started_scrape_subproject_not_in_index() {
    for project in $(started_scrape); do
        subproject_list_file=__tmp_subprojects_list_$(date +%s).txt
        started_scrape $project > $subproject_list_file

        subproject_index_file=__tmp_subprojects_index_$(date +%s).txt
        project_index $project > $subproject_index_file

        not_in_index=$(diff $subproject_list_file $subproject_index_file | grep '^< ' | cut -c '3-')
        for subproject in $not_in_index; do
            echo $project/$subproject
            if [ "$1" = "remove_dirs" ]; then
                rm -rf projects/$project/$subproject
            fi
        done
        rm __tmp_subprojects_*
    done
}
cache_stats() {
    project=$1
    if [ "$project" ]; then
        project_info $project > projects/$project/_stats.txt
        for subproject in $(started_scrape $project); do
            project_info $project $subproject > projects/$project/$subproject/_stats.txt
        done
        return
    fi

    for project in $(started_scrape); do
        project_info $project > projects/$project/_stats.txt
        for subproject in $(started_scrape $project); do
            project_info $project $subproject > projects/$project/$subproject/_stats.txt
        done
    done
}
started_scrape_no_index_or_meta() {
   grep -l no_subprojects_meta_laz_or_las projects/*/_stats.txt 2>/dev/null
}

projects_with_no_meta_xml() {
    grep -l 'meta_xml:0' projects/*/_stats.txt 2>/dev/null | sed -E -e 's@/_stats.txt@@' -e 's@.+/@@'
}
subprojects_with_no_meta_xml() {
    grep -l 'meta_xml:0' projects/*/*/_stats.txt 2>/dev/null | sed -E -e 's@/_stats.txt@@' -e 's@.+/@@'
}
projects_with_meta_xml() {
    grep -l 'meta_xml:[^0]' projects/*/_stats.txt 2>/dev/null | sed -E -e 's@/_stats.txt@@' -e 's@.+/@@'
}
subprojects_with_meta_xml() {
    grep -l 'meta_xml:[^0]' projects/*/*/_stats.txt 2>/dev/null | sed -E -e 's@/_stats.txt@@' -e 's@.+/@@'
}

scrape_errors() {
  find projects/ -type f -name '_errors.txt' | grep -v backup | wc -l
}

scrape_errors_uncaught() {
  wc -l scrape*.error
}
scrape_stat_files() {
  find projects/ -mindepth 1 -maxdepth 2 -type f -name '_stats.txt' | grep -v backup

}

projects_with_xml_count() {
  head -1 --quiet projects/*/meta/xml_files.txt projects/*/*/meta/xml_files.txt | wc -l
}
xml_files_count() {
  cat projects/*/meta/xml_files.txt projects/*/*/meta/xml_files.txt | wc -l
}
xml_extracted_data_files_count() {
  ls projects/*/meta/*xml.txt projects/*/*/meta/*xml.txt | wc -l
}
xml_extracted_data_files() {
  ls projects/*/meta/*xml.txt projects/*/*/meta/*xml.txt
}
xml_extracted_data_files_contents() {
  cat projects/*/meta/*xml.txt projects/*/*/meta/*xml.txt
}
xml_leaves_off_files_contents() {
  ls projects/*/meta/leaves-off.txt projects/*/*/meta/leaves-off.txt 2>/dev/null
}
xml_leaves_on_files_contents() {
  ls projects/*/meta/leaves-on.txt projects/*/*/meta/leaves-on.txt 2>/dev/null
}
xml_files_downloaded_count() {
  project=$1
  subproject=$2
  project_path=''

  if [ "$subproject" ]; then
    project_path="-path \*$project\*"
  fi
  if [ "$subproject" ]; then
      project_path="-path \*$project/$subproject\*"
  fi

  find  projects/ -mindepth 3 -maxdepth 4 -type f -path '*/meta/*' $project_path -name '*.xml' | wc -l
}

xml_file_download_in_progress() {
  find  projects/ -mindepth 3 -maxdepth 4 -type f -path '*/meta/*' -name '*xml.scraping'
}

xml_file_downloaded_vs_todownload_by_project() {
  projects=$(started_scrape)
  local xml_downloaded_count="0"
  xml_downloaded_project_names_filename=__xml_downloaded_projects.txt
  echo > $xml_downloaded_project_names_filename
  for project in $projects; do
    project_line=$(grep "${project}~" projects/_index/current/index_with_year_and_state.txt)
    project_state=$(echo $project_line | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

    if  [ "$project_state" ] && [ "$project_state" != "none" ] && [ "$(grep $project_state states-to-scrape.txt)" = "" ]; then
        continue
    fi
    echo $project >> $xml_downloaded_project_names_filename

    if [ -f projects/$project/meta/xml_files.txt ]; then
      project_xml_downloaded=$(xml_files_downloaded_count $project)
      #echo $project expr $xml_downloaded_count + $project_xml_downloaded
      ((xml_downloaded_count = xml_downloaded_count + project_xml_downloaded))
    else
      subprojects_count=$(started_scrape $project | wc -l | xargs echo -n)
      if [ "$subprojects_count" != "0" ]; then
        for subproject in $(started_scrape $projects); do
          if [ -f projects/$project/$subproject/meta/xml_files.txt ]; then
            #echo '__' $subproject $xml_downloaded_count \+ $subproject_xml_downloaded
            subproject_xml_downloaded=$(xml_files_downloaded_count $project $subproject)
            xml_downloaded_count=$((xml_downloaded_count + subproject_xml_downloaded))
          fi
        done;
      fi
    fi

  done
  echo $xml_downloaded_count
}

xml_file_downloaded_vs_todownload() {
  projects=$(started_scrape)
  local xml_downloaded_count="0"
  local xml_to_download_count="0"

  file_path_prefix=/tmp/lidar-scrape-$(date +%s);
  for project in $projects; do
    grep "${project}~" projects/_index/current/index_with_year_and_state.txt > ${file_path_prefix}-year-state.txt
    sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/' ${file_path_prefix}-year-state.txt > ${file_path_prefix}-year.txt
    read -r project_state < ${file_path_prefix}-year.txt
    if  [ "$project_state" ] && [ "$project_state" != "none" ]; then
      grep $project_state states-to-scrape.txt > /dev/null
      if [ "$?" -ne "0" ]; then
        continue
      fi
    fi
    cat projects/*/meta/xml_files.txt projects/*/*/meta/xml_files.txt | wc -l > ${file_path_prefix}-xml-to-download-count.txt
    read -r xml_to_download_count_i < ${file_path_prefix}-xml-to-download-count.txt
    #((xml_to_download_count = xml_to_download_count + xml_to_download_count_i))

    xml_files_downloaded_count $project > ${file_path_prefix}-xml-downloaded-count.txt
    read -r xml_downloaded_count_i < ${file_path_prefix}-xml-downloaded-count.txt
    #((xml_downloaded_count = xml_downloaded_count + xml_downloaded_count_i))
  done
  echo $xml_downloaded_count '/' $xml_to_download_count
}

projects_with_zip_count() {
  head -1 --quiet projects/*/meta/zip_files.txt projects/*/*/meta/zip_files.txt | wc -l
}

project_info() {
    project=$1
    subproject=$2
    project_path=$project
    if [ "$subproject" ]; then
        project_path=$project/$subproject
    fi

    index_count=$(get_line_count projects/$project_path/_index/current/index.txt)
    metadata_dir=$(cat projects/$project_path/_index/current/metadata_dir.txt 2>/dev/null | xargs echo -n)
    laz_dir=$(cat projects/$project_path/_index/current/laz_dir.txt 2>/dev/null | xargs echo -n)
    las_dir=$(cat projects/$project_path/_index/current/las_dir.txt 2>/dev/null | xargs echo -n)

    if [ "$index_count" = "0" ]; then
      if [ "$metadata_dir" ]; then
        echo "meta_dir";
        if [ ! -d projects/$project_path/meta ]; then
            echo 'meta_not_scraped';
        else
            xml_file_count=$(get_line_count projects/$project_path/meta/xml_files.txt)
            echo "meta_xml:$xml_file_count"
            xml_file_downloaded_count=$(ls -1 projects/$project_path/meta/*.xml 2>/dev/null | wc -l)
            echo "meta_xml_downloaded:$xml_file_downloaded_count"
            xml_file_processed_count=$(ls -1 projects/$project_path/meta/*.xml.txt 2>/dev/null | wc -l)
            echo "meta_xml_processed:$xml_file_processed_count"
            zip_file_count=$(get_line_count projects/$project_path/meta/zip_files.txt)
            echo "meta_zip:$zip_file_count"
        fi
      fi
      if [ "$laz_dir" ]; then
        echo 'laz_dir';
        laz_files_downloaded=$(ls -1 projects/$project_path/meta/*.xml.txt 2>/dev/null | wc -l)
        echo "laz_downloaded:$laz_files_downloaded"

      fi
      if [ "$las_dir" ]; then
        echo 'las_dir';
      fi
      if [ ! "$metadata_dir" ] && [ ! "$laz_dir" ] && [ ! "$las_dir" ]; then
        echo 'no_subprojects_meta_laz_or_las';
      fi
    else
       echo "subprojects:$index_count"
    fi
}

xml_data_search() {
  if [ "$1" = "" ]; then
    echo "Usage: count|details  <xml_search_string>"
    return
  fi

  if [ "$1" = "count" ]; then
    grep -E "$2" projects/*/meta/*xml.txt  projects/*/*/meta/*xml.txt | wc -l
  else
    grep -E "$2" projects/*/meta/*xml.txt  projects/*/*/meta/*xml.txt
  fi
}