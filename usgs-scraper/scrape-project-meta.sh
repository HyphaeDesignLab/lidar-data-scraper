. ./utils-stats.sh

scrape_project_meta() {
    if [ ! -d projects/ ]; then
      mkdir projects;
    fi

    project_path="projects"
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

    if [ ! -d $project_path/meta ]; then
      mkdir $project_path/meta
    fi
    meta_dir=$project_path/meta

    project_path_url=""
    if [ $project ]; then
      project_path_url="$project/"
    fi
    if [ $subproject ]; then
      project_path_url="$project/$subproject/"
    fi


    ### DOWNLOAD
    base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    url=$base_url/$project_path_url/metadata/
    curl -s -S --retry 4 --retry-connrefused $url 2> $meta_dir/__errors.txt > $meta_dir/_index.html
    if [ $(get_line_count_or_empty $meta_dir/__errors.txt) ]; then
        date | xargs echo -n >> $meta_dir/_errors.txt
        cat $meta_dir/__errors.txt >> $meta_dir/_errors.txt
        rm $meta_dir/__errors.txt
    fi

    grep -E '<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">' $meta_dir/_index.html |
     sed -E -e 's@<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">.+@\1@' \
     > $meta_dir/zip_files.txt

    grep -E '<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">' $meta_dir/_index.html |
     sed -E \
      -e 's@<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">.+@\1@' \
      -e 's@/@@' \
      > $meta_dir/xml_files.txt
}

if [ "$(basename $0)" = "scrape-project-meta.sh" ]; then
    scrape_project_meta $1 $2
fi