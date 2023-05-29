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
  -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]).+@\1~\2@' \
  -e 's@/@@' \
  -e '/_/ !d' \
 index.html > index.txt


has_index=$(grep -cvE 'metadata~' index.html)
if [ "$projectName" ] && [ ! $has_index ]; then
  #  NO subprojects in this project
  echo NO subprojects in this project > info.txt
fi

echo

### MAKE STATS / DIFF with previous (currents)
current_dir_path=../../current

if [ -d $current_dir_path ]; then
  diff $current_dir_path/index.txt index.txt | grep -E '^<' | sed -E -e 's/^< //' > removed.txt
  diff $current_dir_path/index.txt index.txt | grep -E '^>' | sed -E -e 's/^> //' > added.txt

  sed -E \
   -e 's/~20[0-9]{2}.+$//' \
   -e 's/^.*(20[0-9]{2}).*$/\1/' \
   -e '/20[0-9]/ !s/.+/unknown/' \
   removed.txt | sort | uniq > removed-years.txt

  sed -E \
   -e 's/~20[0-9]{2}.+$//' \
   -e 's/.*(20[0-9]{2}).*/\1/' \
   -e '/20[0-9]/ !s/.+/unknown/' \
   added.txt | sort | uniq > added-years.txt

  echo $(wc -l index.txt | sed -E 's/^ *([0-9]+) .*$/\1/') total project > stats.txt
  echo $(wc -l $current_dir_path/index.txt | sed -E 's/^ *([0-9]+) .*$/\1/') old total projects >> stats.txt
  echo $(wc -l removed.txt)  >> stats.txt
  echo $(wc -l added.txt) >> stats.txt
  echo >> stats.txt

  echo 'removed years counts:' >> stats.txt
  for year in $(cat removed-years.txt); do
    echo -n " $year:" >> stats.txt
    grep -Ec "[^~]$year" removed.txt >> stats.txt
  done;
  echo

  echo 'added years counts:' >>stats.txt
  for year in $(cat added-years.txt); do
    echo -n " $year:" >> stats.txt
    grep -c "[^~]$year" added.txt >> stats.txt
  done;


  rm -rf $current_dir_path
  cp -r . $current_dir_path
else
  echo 'first time scraping' > stats.txt
  cp -r . $current_dir_path
fi
cd ../../

if [ "$projectName" != "" ]; then
  cd ..
fi
if [ "$subprojectName" != "" ]; then
  cd ..
fi
cd ../../

