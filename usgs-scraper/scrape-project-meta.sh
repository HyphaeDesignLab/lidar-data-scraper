original_dir=$(pwd)
. ./utils-stats.sh

scrape_project_meta() {

    if [ ! -d projects ]; then
      mkdir projects;
    fi

    cd projects

    projectName="$1"
    subprojectName="$2"
    if [ ! -d $projectName ]; then
      mkdir $projectName;
    fi
    cd $projectName

    if [ $subprojectName ]; then
      if [ ! -d $subprojectName ]; then
        mkdir $subprojectName;
      fi
      cd $subprojectName
    fi

    if [ ! -d meta ]; then
      mkdir meta
    fi

    cd meta

    project_path=""
    if [ $projectName ]; then
      project_path="$projectName"
    fi
    if [ $subprojectName ]; then
      project_path="$projectName/$subprojectName"
    fi

    ### DOWNLOAD
    base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
    url=$base_url/$project_path/metadata/
    echo curl -s -S --retry 4 --retry-connrefused $url 2>__errors.txt > _index.html
    exit
    if [ $(get_line_count_or_empty __errors.txt) ]; then
        date | xargs echo -n >> _errors.txt
        cat __errors.txt >> _errors.txt
        rm __errors.txt
    fi

    grep -E '<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">' _index.html |
     sed -E -e 's@<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">.+@\1@' \
     > zip_files.txt

    grep -E '<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">' _index.html |
     sed -E \
      -e 's@<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">.+@\1@' \
      -e 's@/@@' \
      > xml_files.txt

    cd .. # /cd meta

    if [ "$subprojectName" != "" ]; then
      cd .. # /cd $subprojectName
    fi

    cd .. # /cd $projectName

    cd .. # /cd projects
}