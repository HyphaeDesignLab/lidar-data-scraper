base_dir=$(dirname $0)
cd $base_dir

# included by scrape-meta-index.sh
#. ./utils.sh
#. ./utils-stats.sh

. ./scrape-index-helper.sh
. ./scrape-meta-index.sh

echo;

if [ "$LIDAR_SCRAPER_DEBUG" != '' ]; then
  start_mock_server_debug;
fi

scrape_index() {
  if [ -f projects/STOP_SCRAPE.txt ] && [ -s projects/STOP_SCRAPE.txt ]; then
    echo Stopping scrape...
    stop_mock_server_debug
    exit;
  fi;

    local project="$1"
    local project_path=projects
    if [ "$1" != '' ]; then
        project_path=projects/$project
    fi

    # '' blank (default):  only scrape if project is missing
    # if_updated:  scrape if last modified date has changed, i.e. has updated
    # force_scrape:  re-scrape no matter what
    local mode="$2"

    local level=0
    local indentation='' # 0 spaces for top-level
    local next_level_label='project'
    local short_project_name='USGS projects'
    if [ "$project" = '' ] || [ "$project" = 'all' ]; then
      project=''
    else
      level=1
      next_level_label='subproject'
      indentation='  ' # 2 spaces for project
      short_project_name=$project
      if [[ "$project" = *'/'* ]]; then
        level=2
        indentation='    ' # 4 spaces for sub project
        short_project_name=$(cut -d'/' -f 2 <<< $project)  # get the subproject name (after slash /)
      fi
    fi

    echo "$indentation -- $short_project_name --"
    echo_if_debug "scrape-index.sh  level:$level, indent: project:$project, short_project_name:$short_project_name"

    # if index not scraped yet OR "top-level" index (i.e. blank) OR mode=FORCE
    if [ "$level" = 0 ]; then
        echo "$indentation scraping index... (always for all projects)";
        scrape_index_helper $project
    elif [ ! -f $project_path/_index/current/index.txt ]; then
        echo "$indentation index not scraped yet, scraping for first time... ";
        scrape_index_helper $project
    elif [ "$mode" = 'force' ]; then
        echo "$indentation force-update re-scraping index... ";
        scrape_index_helper $project
    else
        echo "$indentation index already scraped";
    fi

    local index=($(project_index $project))
    local index_count=${#index[@]}

    # if top-level (0) or project level (1), less than 2 (sub-project level)
    if [ "$level" -lt 2 ]; then
      echo "$indentation  $index_count $next_level_label found"
      local _i=0
      local item_i=''
      for item_i in ${index[@]}; do
          ((_i++))
          echo
          echo "$indentation ${next_level_label} $_i of $index_count"

          local line_in_index=$(grep "${item_i}~" $project_path/_index/current/index_with_year_and_state.txt)
          local state=$(echo $line_in_index | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

          # skip states that are NOT in STATES to SCRAPE
          if  [ "$state" != '' ] && [ "$state" != "none" ] && ! grep $state states-to-scrape.txt >/dev/null; then
              echo "$indentation skipping because state $state is NOT in list of states to scrape"
              continue
          fi

          local item_recursive_arg="$item_i"
          if [ "$project" != '' ]; then
            item_recursive_arg=$project/$item_i
          fi

          local should_scrape=0
          if [ ! -d "projects/$item_recursive_arg" ] || [ "$mode" = 'force' ]; then
            should_scrape=1
          elif [ "$mode" = 'if_updated' ]; then
            if grep -E "^$item_i~" $project_path/_index/current/diff/changes.txt >/dev/null; then
              should_scrape=1
            fi
          fi
          if [ "$should_scrape" ]; then
            echo_if_debug "scrape-index.sh should_scrape:$should_scrape $item_recursive_arg"
            scrape_index $item_recursive_arg $mode
            throttle_scrape 250/60 50/20 20/10 10/3 5/2
          fi
          echo_if_debug "scrape-index.sh next"
      done;
    else
      local should_scrape=0
      echo_if_debug "scrape-index.sh meta index scrape: $project_path/_index/current/metadata_dir.txt "
      if [ ! -f  $project_path/_index/current/metadata_dir.txt ]; then
          if [ ! -f $project_path/meta/xml_files.txt ] || [ ! -f  $project_path/meta/_current/xml_files.txt ]; then
            echo "$indentation metadata scraping";
            local should_scrape=1
          fi
      elif [ "$mode" = 'if_updated' ] && [ -f $project_path/_index/current/metadata_dir.txt ] && grep "^$(cat $project_path/_index/current/metadata_dir.txt)" $project_path/_index/current/diff/meta_laz_changes.txt 2>/dev/null >/dev/null; then
        echo "$indentation metadata dir has changed... scraping";
        local should_scrape=1
      elif [ "$mode" = 'force' ]; then
        local should_scrape=1
        echo "$indentation metadata already scraped, but scraping AGAIN";
      else
        echo "$indentation metadata already scraped";
      fi

      if [ "$should_scrape" ]; then
        scrape_meta_index $project $mode
        throttle_scrape 250/60 50/20 20/10 10/3 5/2
      fi
    fi
    project_info $project > $project_path/_stats.txt
}


if [ "$1" = '' ] || [ "$2" = '' ]; then
  echo 'Usage: scrape-index.sh <project_name> <mode>'
  echo '  where project_name is "all" or e.g. "CA_some_prj_2020" or "CA_some_prj_2020/CA_some_subproject" '
  echo '  where mode is "normal", "if_updated", or "force"'
else
  scrape_index $1 $2;
fi