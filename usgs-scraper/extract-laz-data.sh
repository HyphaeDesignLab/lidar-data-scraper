
extract_laz_data() {
  for fff in $(ls projects/*/laz/*.laz projects/*/*/laz/*.laz); do
    if [ -f $fff.txt ]; then
      continue
    fi;

    echo Extracting LAZ data from $fff
    python3 laz-extract-data.py $fff > $fff.txt

    if [ -f STOP-LAZ-DATA-EXTRACT.txt ]; then
      break;
    fi

    sleep 1
  done
  if [ -f STOP-LAZ-DATA-EXTRACT.txt ]; then
    rm STOP-LAZ-DATA-EXTRACT.txt
  fi

  sleep 1
  echo
  echo
  echo
  date
  read -p 'Do you want to continue checking for more LAZ files? (y/n) ' zzz
  if [ "$zzz" = "y" ]; then
    echo "trying to find more LAZ files...."
    extract_laz_data;
  fi
}

extract_laz_data;