script_base_dir=$(pwd)
. ./utils-stats.sh

scrape_project_index() {
    local project_path="projects"
    if [ $project ]; then
        project_path="projects/$project"
    fi
    #backup_dir=backup/2023-05-29---15-56-46
    local backup_dir=$project_path/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)
    mkdir -p $backup_dir

    local current_dir=$project_path/_index/current

    ### DOWNLOAD
    local base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    # --location: follow 3xx HTTP response redirects
    curl -s -S --retry 4 --retry-connrefused --location $base_url/$project/ 2> $backup_dir/__errors.txt > $backup_dir/_index.html
    if [ "$(grep '404 Not Found' $backup_dir/_index.html)" ]; then
      echo '404 not found' >> $backup_dir/__errors.txt
    fi
    if [ $(get_line_count_or_empty $backup_dir/__errors.txt) ]; then
        date | xargs echo -n >> $backup_dir/_errors.txt
        cat $backup_dir/__errors.txt >> $backup_dir/_errors.txt
        rm $backup_dir/__errors.txt
    fi

    # get directory name and last modified out of HTML
    #    skip (d=delete) all lines that are not DIR
    #    get the href PATH and the YYYY-MM-DD HH:MM timestamp and -/12K/1.2M/200M file size
    #    finally remove slashes in href PATH and trailing - (i.e. missing/not-applicable file size)
    sed -E \
      -e '/<img[^>]+alt="\[DIR\]">/ !d' \
      -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9]) +([0-9][0-9]:[0-9][0-9]) +([-0-9KMG\.]+).*@\1~\2T\3~\4@' \
      -e 's@/@@;s/-$//;' \
     $backup_dir/_index.html > $backup_dir/___dirs_and_details.txt


    # get only directories containing underscore (_); that implies it is a sub-project
    #   save them to index.txt
    grep '_' $backup_dir/___dirs_and_details.txt > $backup_dir/index_details.txt
    grep -v '_' $backup_dir/___dirs_and_details.txt > $backup_dir/meta_laz_details.txt

    sed -E -e 's/^([^~]+)~.+/\1/' $backup_dir/index_details.txt > $backup_dir/index.txt
    sed -E -e 's/^([^~]+)~.+/\1/' $backup_dir/___dirs_and_details.txt > $backup_dir/___dirs.txt

    local states_filter="$(tr '\n' '|' < states-to-scrape.txt | sed -E -e 's/\|$//')"
    python3 $script_base_dir/get-project-year-and-state.py $backup_dir/index.txt | grep -E "~$states_filter~" > $backup_dir/index_with_year_and_state.txt

    if [ "$project" ]; then
      grep -io '^meta(data)?$' $backup_dir/___dirs.txt 2>/dev/null > $backup_dir/metadata_dir.txt
      if [ "$?" = "1" ]; then
        rm $backup_dir/metadata_dir.txt
      fi
      grep -io '^la[zs]?$' $backup_dir/___dirs.txt 2>/dev/null > $backup_dir/laz_dir.txt
      if [ "$?" = "1" ]; then
        rm $backup_dir/laz_dir.txt
      fi
    fi

    # remove temporary files
    rm $backup_dir/___*.txt

    ### START DIFF/STATS
    ### MAKE STATS / DIFF with previous (currents)
    mkdir $backup_dir/diff
    if [ -d $current_dir ]; then
      # do diffs side-by-side
      diff --side-by-side $current_dir/index.txt $backup_dir/index.txt | tr -d '\t ' | grep -E '<$' | sed -E -e 's/<$//' > $backup_dir/diff/removed.txt
      diff --side-by-side $current_dir/index.txt $backup_dir/index.txt | tr -d '\t ' | grep -E '^>' | sed -E -e 's/^>//' > $backup_dir/diff/added.txt
      if [ ! -f $current_dir/index_details.txt ]; then
        echo > $current_dir/index_details.txt
      fi
      diff --side-by-side $current_dir/index_details.txt $backup_dir/index_details.txt | tr -d '\t ' | grep '|' > $backup_dir/diff/changes.txt

      # diff on meta/laz dir details
      if [ ! -f $current_dir/meta_laz_details.txt ]; then
        echo > $current_dir/meta_laz_details.txt
      fi
      diff --side-by-side $current_dir/meta_laz_details.txt $backup_dir/meta_laz_details.txt | tr -d '\t ' | grep '|' > $backup_dir/diff/meta_laz_changes.txt 2>/dev/null

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