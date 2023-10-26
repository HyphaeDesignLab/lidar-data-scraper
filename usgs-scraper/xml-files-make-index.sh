# Make a hexadecimal index from the index position of the xml files in the list of files
#
xml_files_make_index() {
  local project="$1"
  if [ ! "$project" ]; then
    return 1;
  fi
  if [ ! -f "projects/$project/meta/_index/current/xml_files.txt" ]; then
    return 2;
  fi

  local _i=1;
  local _file_name;
  echo -n > projects/$project/meta/_index/current/xml_files_index.txt;

  # we assume that there is a maximum of 16 * 16 * 16 * 16 = 65536 files
  #  so that the IDs in hexadecimal can be a max of 4 hex characters (with 0 padding)
  #  if there is more thatn 16^4 files, error, because we will need more than 4 chars
  #    if we ever get there we will adjust
  if [ "$(wc -l projects/$project/meta/_index/current/xml_files.txt)" -gt 65536 ]; then
    returun 3
  fi

  for _file_name in $(cat projects/$project/meta/_index/current/xml_files.txt); do
    printf "$_file_name:%04x\n" $_i >> projects/$project/meta/_index/current/xml_files_index.txt;
    ((_i++));
  done
}

if [[ "$0" == *'xml-files-make-index.sh' ]] && [ "$1" = "run" ]; then
  xml_files_make_index $2
fi