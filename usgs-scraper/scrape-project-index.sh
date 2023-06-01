original_dir=$(pwd)
if [ ! -d projects ]; then
  mkdir projects;
fi

cd projects/

projectName="$1"
subprojectName="$2"
# if projectName
if [ $projectName ]; then
  if [ ! -d $projectName ]; then
    mkdir $projectName;
  fi
  cd $projectName
fi
if [ $subprojectName ]; then
  if [ ! -d $subprojectName ]; then
    mkdir $subprojectName;
  fi
  cd $subprojectName
fi

if [ ! -d _index ]; then
  mkdir _index
fi

cd _index


if [ ! -d backup ]; then
  mkdir backup
fi
#backup_dir=backup/2023-05-29---15-56-46
backup_dir=backup/$(date +%Y-%m-%d---%H-%M-%S)
mkdir $backup_dir
cd $backup_dir

projectNameForUrl=""
if [ $projectName ]; then
  projectNameForUrl="$projectName/"
fi
subprojectNameForUrl=""
if [ $subprojectName ]; then
  subprojectNameForUrl="$subprojectName/"
fi

### DOWNLOAD
base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/
curl  $base_url$projectNameForUrl$subprojectNameForUrl > index.html

sed -E \
  -e '/<img[^>]+alt="\[DIR\]">/ !d' \
  -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]).+@\1@' \
  -e 's@/@@' \
 index.html > tmp.txt

grep '_' tmp.txt > index.txt
python3 $original_dir/get-project-year-and-state.py $projectName > index_with_year_and_state.txt

if [ "$projectName" ]; then
  metadata_dir=$(grep -oE '^metadata~' tmp.txt | sed -e 's/~//' | xargs echo -n)
  if [ $metadata_dir ]; then
    echo $metadata_dir > metadata_dir.txt
  fi
  laz_dir=$(grep -ioE '^laz~' tmp.txt | sed -e 's/~//' | xargs echo -n)
  if [ $laz_dir ]; then
    echo $laz_dir > laz_dir.txt
  fi
  las_dir=$(grep -ioE '^las~' tmp.txt | sed -e 's/~//' | xargs echo -n)
  if [ $las_dir ]; then
    echo $las_dir > las_dir.txt
  fi
fi

rm tmp.txt

### START DIFF/STATS
### MAKE STATS / DIFF with previous (currents)
current_dir_path=../../current
mkdir diff
if [ -d $current_dir_path ]; then
  diff $current_dir_path/index.txt index.txt | grep -E '^<' | sed -E -e 's/^< //' > diff/removed.txt
  diff $current_dir_path/index.txt index.txt | grep -E '^>' | sed -E -e 's/^> //' > diff/added.txt

  sed -E \
   -e 's/~20[0-9]{2}.+$//' \
   -e 's/^.*(20[0-9]{2}).*$/\1/' \
   -e '/20[0-9]/ !s/.+/unknown/' \
   diff/removed.txt | sort | uniq > diff/removed-years.txt

  sed -E \
   -e 's/~20[0-9]{2}.+$//' \
   -e 's/.*(20[0-9]{2}).*/\1/' \
   -e '/20[0-9]/ !s/.+/unknown/' \
   diff/added.txt | sort | uniq > diff/added-years.txt

  echo $(wc -l index.txt | sed -E 's/^ *([0-9]+) .*$/\1/') total project > diff.txt
  echo $(wc -l $current_dir_path/index.txt | sed -E 's/^ *([0-9]+) .*$/\1/') old total projects >> diff.txt
  echo $(wc -l diff/removed.txt)  >> diff.txt
  echo $(wc -l diff/added.txt) >> diff.txt
  echo >> diff.txt

  echo 'removed years counts:' >> diff.txt
  for year in $(cat diff/removed-years.txt); do
    echo -n " $year:" >> diff.txt
    grep -Ec "[^~]$year" diff/removed.txt >> diff.txt
  done;
  echo

  echo 'added years counts:' >>diff.txt
  for year in $(cat diff/added-years.txt); do
    echo -n " $year:" >> diff.txt
    grep -c "[^~]$year" diff/added.txt >> diff.txt
  done;

  rm -rf $current_dir_path
else
  echo 'first time scraping' > diff.txt
fi
cp -r . $current_dir_path
cd ../../
### END DIFF/STATS

if [ "$projectName" != "" ]; then
  cd ..
fi
if [ "$subprojectName" != "" ]; then
  cd ..
fi
cd ../../

