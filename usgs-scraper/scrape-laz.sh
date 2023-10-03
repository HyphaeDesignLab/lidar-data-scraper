cd $(dirname $0)

for fff in $(ls projects/*/meta/*xml projects/*/*/meta/*.xml); do
  laz_file=$(echo $fff | sed -e '
  s/meta/laz/
  s/.xml/.laz/
  s@projects/@@
  ')
  curl https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/$laz_file > $fff.laz
  sleep 1
done
