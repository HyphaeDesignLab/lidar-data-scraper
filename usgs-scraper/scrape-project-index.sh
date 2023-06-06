script_base_dir=$(pwd)
. ./utils-stats.sh

scrape_project_index() {

    if [ ! -d projects/ ]; then
      mkdir projects;
    fi

    local project_path="projects"
    project="$1"
    subproject="$2"
    if [ $project ]; then
        project_path="projects/$project"
      if [ ! -d $project_path ]; then
        mkdir $project_path;
      fi
    fi
    if [ $subproject ]; then
        project_path="projects/$project/$subproject"
      if [ ! -d $project_path ]; then
        mkdir $project_path;
      fi
    fi

    if [ ! -d $project_path/_index ]; then
      mkdir $project_path/_index
    fi

    if [ ! -d $project_path/_index/backup ]; then
      mkdir $project_path/_index/backup
    fi
    #backup_dir=backup/2023-05-29---15-56-46
    backup_dir=$project_path/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)
    mkdir $backup_dir

    local project_path_url=""
    if [ $project ]; then
      project_path_url="$project/"
    fi
    if [ $subproject ]; then
      project_path_url="$project/$subproject/"
    fi

    ### DOWNLOAD
    base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    url=$base_url/$project_path_url
    curl -s -S --retry 4 --retry-connrefused $url 2> $backup_dir/__errors.txt > $backup_dir/_index.html
    if [ "$(grep '404 Not Found' $backup_dir/_index.html)" ]; then
      echo '404 not found' >> $backup_dir/__errors.txt
    fi
    if [ $(get_line_count_or_empty $backup_dir/__errors.txt) ]; then
        date | xargs echo -n >> $backup_dir/_errors.txt
        cat $backup_dir/__errors.txt >> $backup_dir/_errors.txt
        rm $backup_dir/__errors.txt
    fi

    sed -E \
      -e '/<img[^>]+alt="\[DIR\]">/ !d' \
      -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]).+@\1@' \
      -e 's@/@@' \
     $backup_dir/_index.html > $backup_dir/tmp.txt

    grep '_' $backup_dir/tmp.txt > $backup_dir/index.txt
    if [ ! "$subproject" ]; then
        python3 $script_base_dir/get-project-year-and-state.py $backup_dir/index.txt > $backup_dir/index_with_year_and_state.txt
    fi

    if [ "$project" ]; then
      if [ "$(grep -o '^metadata$' $backup_dir/tmp.txt)" ]; then
        echo metadata > $backup_dir/metadata_dir.txt
      fi
      if [ "$(grep -io '^laz$' $backup_dir/tmp.txt)" ]; then
        echo laz > $backup_dir/laz_dir.txt
      fi
      if [ "$(grep -io '^las$' $backup_dir/tmp.txt)" ]; then
        echo las > $backup_dir/las_dir.txt
      fi
    fi

    rm $backup_dir/tmp.txt

    ### START DIFF/STATS
    ### MAKE STATS / DIFF with previous (currents)
    current_dir=$backup_dir/../../current
    mkdir $backup_dir/diff
    if [ -d $current_dir ]; then
      diff $current_dir/index.txt $backup_dir/index.txt | grep -E '^<' | sed -E -e 's/^< //' > $backup_dir/diff/removed.txt
      diff $current_dir/index.txt $backup_dir/index.txt | grep -E '^>' | sed -E -e 's/^> //' > $backup_dir/diff/added.txt

      sed -E \
       -e 's/~20[0-9]{2}.+$//' \
       -e 's/^.*(20[0-9]{2}).*$/\1/' \
       -e '/20[0-9]/ !s/.+/unknown/' \
       $backup_dir/diff/removed.txt | sort | uniq > $backup_dir/diff/removed-years.txt

      sed -E \
       -e 's/~20[0-9]{2}.+$//' \
       -e 's/.*(20[0-9]{2}).*/\1/' \
       -e '/20[0-9]/ !s/.+/unknown/' \
       $backup_dir/diff/added.txt | sort | uniq > $backup_dir/diff/added-years.txt

      echo $(get_line_count $backup_dir/index.txt) total project > $backup_dir/diff.txt
      echo $(get_line_count $current_dir/index.txt) old total projects >> $backup_dir/diff.txt
      echo $(get_line_count $backup_dir/diff/removed.txt) removed >> $backup_dir/diff.txt
      echo $(get_line_count $backup_dir/diff/added.txt) added >> $backup_dir/diff.txt
      echo >> $backup_dir/diff.txt

      rm -rf $current_dir
    else
      echo 'first time scraping' > $backup_dir/diff.txt
    fi
    cp -r $backup_dir $current_dir
    ### END DIFF/STATS

}

if [ "$(basename $0)" = "scrape-project-index.sh" ]; then
    scrape_project_index $1 $2
fi