
extract_laz_data() {
  for fff in projects/*/laz/*.laz projects/*/*/laz/*.laz; do
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
  sleep 1
  echo
  echo
  echo
  date
  echo "trying to find more LAZ files...."
  extract_laz_data;
}

extract_laz_data;