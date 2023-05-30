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

projectNameForUrl=""
if [ $projectName ]; then
  projectNameForUrl="$projectName"
fi
subprojectNameForUrl=""
if [ $subprojectName ]; then
  subprojectNameForUrl="/$subprojectName"
fi

### DOWNLOAD
base_url=https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects
curl  $base_url/$projectNameForUrl$subprojectNameForUrl/metadata/ > _index.html

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

