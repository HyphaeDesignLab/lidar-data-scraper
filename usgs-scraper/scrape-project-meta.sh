. ./utils-stats.sh

scrape_project_meta() {
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

    if [ ! -d $project_path/meta ]; then
      mkdir $project_path/meta
    fi
    meta_dir=$project_path/meta

    local project_path_url=""
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
    if [ "$(grep '404 Not Found' $meta_dir/_index.html)" ]; then
      echo '404 not found' >> $meta_dir/__errors.txt
    fi
    if [ $(get_line_count_or_empty $meta_dir/__errors.txt) ]; then
        date | xargs echo -n >> $meta_dir/_errors.txt
        cat $meta_dir/__errors.txt >> $meta_dir/_errors.txt
    fi
    rm $meta_dir/__errors.txt

    grep -E '<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">' $meta_dir/_index.html |
     sed -E -e 's@<img[^>]+compressed.gif[^>]+> *<a href="([^"]+)">.+@\1@' \
     > $meta_dir/zip_files.txt

    grep -E '<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">' $meta_dir/_index.html |
     sed -E \
      -e 's@<img[^>]+alt="\[TXT\]"> *<a href="([^"]+).xml">.+@\1@' \
      -e 's@/@@' \
      -e "s/USGS_LPC_/{u}/" \
      -e "s/$project/{prj}/" \
      > $meta_dir/xml_files.txt
}

xml_check_empty_or_not_found() {
  if [ -s $1 ]; then
    grep -HF '404 Not Found' $1 | sed 's/404 Not Found/not_found/';
  else
    echo $1:empty
  fi;
}
xml_file_list() {
  find projects/ -type f -path '*/meta/*' -name '*.xml'
}
scrape_meta_check_empty() {
  if [ ! "$1" ]; then
    echo "to check all files and then do counts: $0 check_empty filein fileout"
    echo " OR"
    echo "to ONLY show counts: $0  check_empty file"
    return 1
  fi

  filein=$1
  fileout=$2
  if [ "$2" ]; then
    if [ ! -f $filein ]; then
      xml_file_list > $filein
    fi;
    while read -r line; do xml_check_empty_or_not_found $line; done < $filein > $fileout
  else
    fileout=$1
  fi

  if [ ! -f $fileout ]; then
    echo "no such file $fileout";
    return;
  fi;

  echo -n 'not found: ';
  grep -c 'not_found$' $fileout;

  echo -n 'empty: ';
  grep -c 'empty$' $fileout;
}
check_missing_projects() {
  if [ ! "$1" ] || [ ! "$2" ]; then
    echo "$0 check_missing_projects <project_lsit_file> <status_file_name>";
    echo " where <status_file_name> and <status_file_name>.error will be saved to each <project>/meta/ dir when requesting usgs.gov/<prj>/meta/index.html"
  fi
  for prj in $(cat $1); do
    curl -s -S --retry 4 --retry-connrefused https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/$prj/metadata/ 2>projects/$prj/meta/$2.error 1>projects/$prj/meta/$2
    sleep .5
  done

  for prj in $(cat $1); do
    grep -HF '404 Not Found' projects/$1/meta/$2
  done
}

if [ "$(basename $0)" = "scrape-project-meta.sh" ]; then
  if [ ! "$1" ]; then
    echo "to scrape all meta files: $0 all|<project> <?subproject>"
    echo " OR"
    echo "to check if empty meta files: $0  check_empty ..."
    echo "to check projects that have been taken offline: $0  check_missing_projects ..."
    exit;
  fi
  if [ "$1" = "check_empty" ]; then
    scrape_meta_check_empty $2 $3
  if [ "$1" = "check_missing_projects" ]; then
    scrape_meta_check_empty $2 $3
  else
    if [ "$1" = "all" ]; then
      scrape_project_meta
    else
      scrape_project_meta $1 $2
    fi
  fi
fi