
extract_laz_data() {
  for fff in $(ls projects/*/meta/*xml.laz projects/*/*/meta/*.xml.laz); do
    if [ -f $fff.txt ]; then
      continue
    fi;

    echo Extracting LAZ data from $fff
    python3 laz-extract-data.py $fff > $fff.txt
    sleep 1
  done

  if [ -f STOP-LAZ-DATA-EXTRACT.txt ]; then
    return;
  fi
  extract_laz_data;
}

extract_laz_data;