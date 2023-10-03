base_dir=$(dirname $0)
cd $base_dir

# included by scrape-meta-index-helper.sh
#. ./utils.sh
#. ./utils-stats.sh

. ./scrape-index-helper.sh
. ./scrape-meta-index-helper.sh

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
    if [ "$project" = '' ] || [ "$project" = 'all' ]; then
      project=''
    fi

    local project_path=projects
    if [ "$project" != '' ]; then
        project_path=projects/$project
    fi

    # 'normal' blank (default):  only scrape if project is missing
    # if_updated:  scrape if last modified date has changed, i.e. has updated
    # force_scrape:  re-scrape no matter what
    local mode="$2"
    if [ "$mode" = '' ]; then
      mode="normal"
    fi

    # 'normal' blank (default):  only scrape if project is missing
    # if_updated:  scrape if last modified date has changed, i.e. has updated
    # force_scrape:  re-scrape no matter what
    local is_recursive="$3"
    if [ "$is_recursive" = '' ]; then
      is_recursive="no"
    fi

    local level=0
    local indentation='' # 0 spaces for top-level
    local next_level_label='project'
    local short_project_name='USGS projects'
    local short_project_id=''
    if [ "$project" != '' ]; then
      level=1
      next_level_label='subproject'
      indentation='  ' # 2 spaces for project
      short_project_name=$project
      short_project_id=$project
      if [[ "$project" = *'/'* ]]; then
        level=2
        indentation='    ' # 4 spaces for sub project
        short_project_name=$(cut -d'/' -f 2 <<< $project)  # get the subproject name (after slash /)
        short_project_id=$short_project_name  # get the subproject name (after slash /)
      fi
    fi

    echo "$indentation -- $short_project_name --"
    echo "$indentation    (mode: $mode, recursive: $is_recursive)"
    echo_if_debug "scrape-index.sh  level:$level, indent: project:$project, short_project_name:$short_project_name, "

    throttle_scrape 250/60 50/20 20/10 10/3 5/2

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
    elif [ "$mode" = 'if_updated' ]; then
      local project_updates=$(grep -E "^$short_project_id" "$project_path/../_index/current/diff-updated.txt" 2>/dev/null)
      if [ "$project_updates" ]; then
        echo "$indentation re-scraping index as it has changed... ";
        scrape_index_helper $project
      fi
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
          ## local states_filter="$(tr '\n' '|' <states-to-scrape.txt | sed -E -e 's/\|$//')" # alternative to grepping text file every time
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
          if [ "$should_scrape" ] && [ "$is_recursive" = 'yes' ]; then
            echo_if_debug "scrape-index.sh should_scrape:$should_scrape $item_recursive_arg"
            scrape_index $item_recursive_arg $mode $is_recursive
          fi
          echo_if_debug "scrape-index.sh next"
      done;
    else
      echo_if_debug "scrape-index.sh meta index scrape: $project_path/_index/current/metadata_dir.txt "
      if [ -f  $project_path/_index/current/metadata_dir.txt ]; then
        if [ "$mode" = 'normal' ]; then
          if scrape_meta_index_helper__is_not_started $project; then
            echo "$indentation metadata scraping";
            scrape_meta_index_helper $project $mode
          else
            echo "$indentation metadata already scraped";
          fi
        elif [ "$mode" = 'if_updated' ]; then
          if scrape_meta_index_helper__has_been_updated_on_server $project; then
            echo "$indentation metadata dir has changed... scraping";
            scrape_meta_index_helper $project $mode
          else
            echo "$indentation metadata dir has NOT changed";
          fi
        elif [ "$mode" = 'force' ]; then
          echo "$indentation metadata force-scraping";
          scrape_meta_index_helper $project $mode
        else
          echo "$indentation metadata scrape mode UNKNOWN";
        fi
      fi
    fi
    project_info $project > $project_path/_stats.txt
}


if [ "$1" = '' ] || [ "$2" = '' ] || [ "$3" = '' ]; then
  echo 'Usage: scrape-index.sh <project_name> <mode> <is_recursive>'
  echo '  where project_name is "all" or e.g. "CA_some_prj_2020" or "CA_some_prj_2020/CA_some_subproject" '
  echo '  where mode is "normal", "if_updated", or "force"'
  echo '  where is_recursive is "yes" or "no"'
else
  scrape_index $1 $2 $3;
fi