
extract_laz_data() {
  for fff in projects/*/meta/*xml.laz projects/*/*/meta/*.xml.laz; do
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
  sleep 10
  echo
  echo
  echo
  date
  echo "trying to find more LAZ files...."
  extract_laz_data;
}

extract_laz_data;