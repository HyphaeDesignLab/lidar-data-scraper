base_dir=$(dirname $0)
cd $base_dir/projects

projects=$(cat _index/current/index.txt | sed -E -e 's/^([^~]+).+/\1/' | xargs echo -n)

base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects

func_args="$@";
has_arg () {
  for arg in $func_args; do
    if [ "$1" = "$arg" ]; then
      echo 1;
      return
    fi
  done;
}

get_meta_info() {
  project="$1"
  subproject="$2"
  if [ -f  metadata_dir.txt ]; then
    echo '  metadata: ' $base_url/$project/$subproject/$(cat metadata_dir.txt | xargs echo -n)
    echo '   XML files to download '$(wc -l ../../meta/xml_files.txt | sed -E -e 's/^ *([0-9]+) .+/\1/')
    echo '   ZIP files to download '$(wc -l ../../meta/zip_files.txt | sed -E -e 's/^ *([0-9]+) .+/\1/')
  fi
  if [ -f  las_dir.txt ]; then
    echo '  LAS files: ' $base_url/$project/$subproject/$(cat las_dir.txt | xargs echo -n)
  fi
  if [ -f  laz_dir.txt ]; then
    echo '  LAZ files: ' $base_url/$project/$subproject/$(cat laz_dir.txt | xargs echo -n)
  fi
}

if [ $(has_arg general) ]; then
 echo "projects started scraping: " $(find . -type d -d 1 | grep -vE 'meta|_index' | wc -l)
 echo "project+subprojects started scraping: " $(find . -type d -d 2 | grep -vE 'meta|_index' | wc -l)
 echo "size on disk: " $(du -h -d 0 .)
fi;

if [ $(has_arg projects) ]; then
  for project in $projects; do
    cd $project/_index/current/

    echo
    echo
    echo "------$project-------"
    echo ' url: '$base_url/$project/

    subprojects_count=$(wc -l index.txt | sed -E -e 's/^ *([0-9]+) .+/\1/' -e 's/^0$//' | xargs echo -n)

    if [ ! $subprojects_count ]; then
      get_meta_info $project
      cd ../..
    else
      echo ' subprojects (' $subprojects_count '):'
      subprojects=$(cat index.txt | sed -E -e 's/^([^~]+).+/\1/' | xargs echo -n)
      cd ../..
      if [ $(has_arg subprojects) ]; then
        for subproject in $subprojects; do
          cd $subproject/_index/current/
            get_meta_info $project $subproject
          cd ../../..
        done;
      fi
    fi
    cd ..
  done
fi
