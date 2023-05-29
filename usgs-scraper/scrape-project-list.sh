cd projects/

if [ ! -d _index ]; then
  mdkir _index
  mdkir _index/backup
  mdkir _index/current
fi

cd _index

backup_dir=backup/$(date +%Y-%m-%d---%H-%M-%S)
mkdir $backup_dir
cd $backup_dir

### DOWNLOAD
curl  https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/ > index.html

sed -E \
  -e '/<img[^>]+alt="\[DIR\]">/ !d' \
  -e 's@<img[^>]+alt="\[DIR\]"> *<a href="([^"]+)">[^<]+</a> +([0-9]{4}-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]).+@\1~\2@' \
  -e 's@/@@' \
  -e '/_/ !d' \
 index.html > index.txt




### MAKE STATS / DIFF with previous (currents)
diff ../../current/index.txt index.txt | grep -E '^<' | sed -E -e 's/^< //' > removed.txt
diff ../../current/index.txt index.txt | grep -E '^>' | sed -E -e 's/^> //' > added.txt

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
echo $(wc -l ../../current/index.txt | sed -E 's/^ *([0-9]+) .*$/\1/') old total projects >> stats.txt
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

cd ../../
rm -rf current/
cp -r $backup_dir current

cd ../../

