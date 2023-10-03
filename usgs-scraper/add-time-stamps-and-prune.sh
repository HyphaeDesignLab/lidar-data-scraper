cd $(dirname $0)
if [ ! "$___utils_sh_included" ]; then . ./utils.sh; fi
if [ ! "$___utils_stats_sh_included" ]; then . ./utils-stats.sh; fi

# Add last-modified from the index HTML file to the index.txt file
#  Why? So that we can easily compare projects changes (not only by difference in project/subproject)
#       but also by last-modified
add_time_stamps_and_prune() {
  local index_dir="projects/_index/current"
  local project_level='0' # 0: all projects, 1: project, 2: subproject
  if [ "$1" != '' ]; then
    index_dir="projects/$1/_index/current/"
    project_level='1'
    if [ "$2" != '' ]; then
      index_dir="projects/$1/$2/_index/current/"
      project_level='2'
    fi
  fi

  sed -E \
      -e '/<img[^>]+alt="\[DIR\]">/ !d' \
      -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]).+@\1~\2@' \
      -e 's@/@@' \
     $index_dir/_index.html > $index_dir/_tmp_directories.txt

    # get only directories containing underscore (_); that implies it is a sub-project
    #   save them to index.txt
    grep '_' $index_dir/_tmp_directories.txt > $index_dir/_tmp_directories_of_projects.txt
    local states_filter="$(tr '\n' '|' < states-to-scrape.txt | sed -E -e 's/\|$//')" # make a regex list A|B|C| out of A\nB\nC\n and remove trailing |

    # for all-project list and project levels (0 and 1)
    if [ "$project_level" -lt 2 ]; then
        python3 ./get-project-year-and-state.py $index_dir/_tmp_directories_of_projects.txt > $index_dir/_tmp_directories_of_projects_with_year_and_state.txt


        if [ "$project_level" = 0 ]; then
          grep -E "~$states_filter~"  $index_dir/_tmp_directories_of_projects_with_year_and_state.txt > $index_dir/index_with_year_and_state.txt

          # save projects to NOT SCRAPE (if not in the right state), DO ONLY for top-level project list (project level = 0)
          grep -vE "~$states_filter~"  $index_dir/_tmp_directories_of_projects_with_year_and_state.txt | sed -E -e 's/^([^~]+)~.+/\1/' > $index_dir/_tmp_directories_of_projects_NOT_TO_SCRAPE.txt
          for dir_i in $(cat $index_dir/_tmp_directories_of_projects_NOT_TO_SCRAPE.txt); do
            echo rm -rf projects/$dir_i
            ###rm -rf projects/$dir_i
          done;
          unset dir_i;
        else
          echo cp $index_dir/_tmp_directories_of_projects_with_year_and_state.txt \> $index_dir/index_with_year_and_state.txt
          ###cp $index_dir/_tmp_directories_of_projects_with_year_and_state.txt > $index_dir/index_with_year_and_state.txt
        fi

        # save only project/dir names to index.txt
        ###sed -E -e 's/^([^~]+)~.+/\1/' $index_dir/index_with_year_and_state.txt > $index_dir/index.txt
        echo sed -E -e 's/^([^~]+)~.+/\1/' $index_dir/index_with_year_and_state.txt \> $index_dir/index.txt
    fi

    if [ "$project_level" -gt 0 ]; then
      grep -io '^meta(data)?$' $index_dir/tmp.txt 2>/dev/null > $index_dir/metadata_dir.txt
      if [ "$?" = "1" ]; then
        ###rm $index_dir/metadata_dir.txt
        echo rm $index_dir/metadata_dir.txt
      fi
      grep -io '^la[zs]?$' $index_dir/tmp.txt 2>/dev/null > $index_dir/laz_dir.txt
      if [ "$?" = "1" ]; then
        echo rm $index_dir/laz_dir.txt
        ###rm $index_dir/laz_dir.txt
      fi

    fi

    # remove LAS dir file (we should only have LAZ)
    rm $index_dir/las_dir.txt 2>/dev/null
    # remove all TMP files
#    rm \
#      $index_dir/_tmp_directories.txt \
#      $index_dir/_tmp_directories_of_projects.txt \
#      $index_dir/_tmp_directories_of_projects_with_year_and_state.txt \
#      $index_dir/_tmp_directories_of_projects_NOT_TO_SCRAPE.txt \
#      2>/dev/null
}


add_time_stamps__loop_on_all() {
    add_time_stamps_and_prune

    local projects=$(project_index)
    local project=''
    for project in $projects; do

        add_time_stamps_and_prune $project
        local subprojects=$(project_index $project)
        for subproject in $subprojects; do
          add_time_stamps_and_prune $project $subproject
        done
    done
}

add_time_stamps__loop_on_project() {
  add_time_stamps_and_prune $project
  local subprojects=$(project_index $project)
  local subproject=''
  for subproject in $subprojects; do
    add_time_stamps_and_prune $project $subproject
  done
}

if [ "$1" = "all" ]; then
    add_time_stamps__loop_on_all;
elif [ "$1" != "" ]; then
    if [ "$2" = "" ]; then
        add_time_stamps__loop_on_project $1;
    else
        add_time_stamps_and_prune $1 $2;
    fi
fi