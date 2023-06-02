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
    find $projects_path -type d -mindepth 1 -maxdepth 1 ! -name '_index' ! -name 'meta' | sed -e "s@$projects_path/@@" | sort;
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
            zip_file_count=$(get_line_count projects/$project_path/meta/zip_files.txt)
            echo "meta_zip:$zip_file_count"
        fi
      fi
      if [ "$laz_dir" ]; then
        echo 'laz_dir';
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
