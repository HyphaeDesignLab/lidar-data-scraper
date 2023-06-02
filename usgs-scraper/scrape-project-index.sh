original_dir=$(pwd)
. ./utils-stats.sh

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

if [ ! -d $project_path/_index ]; then
  mkdir $project_path/_index
fi

if [ ! -d $project_path/_index/backup ]; then
  mkdir $project_path/_index/backup
fi
#backup_dir=backup/2023-05-29---15-56-46
backup_dir=$project_path/_index/backup/$(date +%Y-%m-%d---%H-%M-%S)
mkdir $backup_dir

project_path_url=""
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
if [ ! "$project" ] && [ ! "$subproject" ]; then
    python3 $original_dir/get-project-year-and-state.py > index_with_year_and_state.txt
fi

if [ "$project" ]; then
  if [ "$(grep -o '^metadata$' $backup_dir/tmp.txt)" ]; then
    echo metadata > metadata_dir.txt
  fi
  if [ "$(grep -io '^laz$' $backup_dir/tmp.txt)" ]; then
    echo laz > laz_dir.txt
  fi
  if [ "$(grep -io '^las$' $backup_dir/tmp.txt)" ]; then
    echo las > las_dir.txt
  fi
fi

rm $backup_dir/tmp.txt

### START DIFF/STATS
### MAKE STATS / DIFF with previous (currents)
current_dir_path=$backup_dir/../../current
mkdir $backup_dir/diff
if [ -d $current_dir_path ]; then
  diff $current_dir_path/index.txt $backup_dir/index.txt | grep -E '^<' | sed -E -e 's/^< //' > $backup_dir/diff/removed.txt
  diff $current_dir_path/index.txt $backup_dir/index.txt | grep -E '^>' | sed -E -e 's/^> //' > $backup_dir/diff/added.txt

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
  echo $(get_line_count $current_dir_path/index.txt) old total projects >> $backup_dir/diff.txt
  echo $(get_line_count $backup_dir/diff/removed.txt) removed >> $backup_dir/diff.txt
  echo $(get_line_count $backup_dir/diff/added.txt) added >> $backup_dir/diff.txt
  echo >> $backup_dir/diff.txt

  rm -rf $current_dir_path
else
  echo 'first time scraping' > diff.txt
fi
cp -r $backup_dir $current_dir_path
### END DIFF/STATS

