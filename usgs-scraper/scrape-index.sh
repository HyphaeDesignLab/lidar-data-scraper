base_dir=$(dirname $0)
cd $base_dir
. ./utils.sh
. ./utils-stats.sh
. ./scrape-index-helper.sh
. ./scrape-meta-index.sh

scrape_index() {
  if [ -f projects/STOP_SCRAPE.txt ]; then rm projects/STOP_SCRAPE.txt; return; fi;

    local project="$1"
    local project_path=projects
    if [ "$1" != '' ]; then
        project_path=projects/$project
    fi

    # '' blank (default):  only scrape if project is missing
    # if_updated:  scrape if last modified date has changed, i.e. has updated
    # force_scrape:  re-scrape no matter what
    local mode="$2"

    local level=''
    local indentation=' ' # 1 spaces for top-level
    if [ "$project" != '' ]; then
      level="prj"
      indentation='  ' # 2 spaces for project
      if [[ "$project" = *'/'* ]]; then
        level="subprj"
        indentation='   ' # 3 spaces for sub project
      fi
    else
      echo 'USGS projects: '
    fi

    if [ ! -f $project_path/_index/current/index.txt ] || [ "$mode" = 'force' ]; then
        echo "$indentation index scraping $project";
        scrape_index_helper $project
    else
        echo "$indentation index already scraped";
    fi

    local subprojects=($(project_index $project))
    local subprojects_count=${#subprojects[@]}
    echo_if_debug subprojects_count:$subprojects_count
    if [ $subprojects_count -gt 0 ]; then
        local subproject_i=0
        for subproject in ${subprojects[@]}; do
            ((subproject_i++))
            echo -n "$indentation ($level) $subproject ($subproject_i/$subprojects_count): "

            local subproject_line_in_index=$(grep "${subproject}~" $project_path/_index/current/index_with_year_and_state.txt)
            local subproject_state=$(echo $subproject_line_in_index | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

            # skip states that are NOT in STATES to SCRAPE
            if  [ "$subproject_state" != '' ] && [ "$subproject_state" != "none" ] && ! grep $subproject_state states-to-scrape.txt >/dev/null; then
                echo " skipping because state $subproject_state is NOT in list of states to scrape"
                continue
            fi

            local subproject_arg="$subproject"
            if [ "$project" != '' ]; then
              subproject_arg=$project/$subproject
            fi

            local should_scrape=0
            if [ ! -d "projects/$subproject_arg" ] || [ "$mode" = 'force' ]; then
              should_scrape=1
            elif [ "$mode" = 'if_updated' ]; then
              if grep -E "^$subproject~" $project_path/_index/current/diff/changes.txt >/dev/null; then
                should_scrape=1
              fi
            fi
            if [ "$should_scrape" ]; then
              echo_if_debug should_scrape:$should_scrape $subproject_arg
              scrape_index $subproject_arg $mode
              throttle_scrape 250/60 50/20 20/10 10/3 5/2
            fi
            echo_if_debug next
        done;
    else
      local should_scrape=0
      if [ ! -f  $project_path/_index/current/metadata_dir.txt ]; then
          if [ ! -f $project_path/meta/xml_files.txt ] || [ ! -f  $project_path/meta/_current/xml_files.txt ]; then
            echo " metadata scraping";
            local should_scrape=1
          fi
      elif [ "$mode" = 'if_updated' ] && [ -f $project_path/_index/current/metadata_dir.txt ] && grep "^$(cat $project_path/_index/current/metadata_dir.txt)" $project_path/_index/current/diff/meta_laz_changes.txt 2>/dev/null >/dev/null; then
        echo " metadata dir has changed... scraping";
        local should_scrape=1
      elif [ "$mode" = 'force' ]; then
        local should_scrape=1
        echo " metadata already scraped, but scraping AGAIN";
      else
        echo " metadata already scraped";
      fi

      echo_if_debug
      if [ "$should_scrape" ]; then
        scrape_meta_index $subproject_arg $mode
        throttle_scrape 250/60 50/20 20/10 10/3 5/2
      fi
    fi
    project_info $project > $project_path/_stats.txt
}


if [ "$1" = "all" ]; then
    scrape_index;
elif [ "$1" != "" ]; then
    if [ "$2" = "" ]; then
        scrape_index $1;
    else
        scrape_index $1 $2;
    fi
fi