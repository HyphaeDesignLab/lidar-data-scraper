# a short-cut to
#   (1) scrape the entire top-level project index
#   (2) scrape the project or project/subproject index
#   (3) scrape the xml files in project or project/subproject
#   (4) make map vector files out of XML files' bounding boxes
_do() {

  #  (1) all projects, force-update scrape mode, no recursion
  ./scrape-index.sh all force no

  # (2) the project/subproject from first arg, force-update, yes-recurse
  ./scrape-index.sh $1 force yes

  # (3)
  # make sure to print full text status to STDOUT (usually it prints only last line)
  #    LIDAR_SCRAPER_COMPACT_TEXT_STATUS=0
  #  the command is "project_xml_files"
  LIDAR_SCRAPER_COMPACT_TEXT_STATUS=0 ./scrape-xml.sh project_xml_files $1
  # OR
  # #### make it in PM2-managed background process ####
    # local pm2id="$(sed 's@/@--@' <<< "$1")"
    # LIDAR_SCRAPER_COMPACT_TEXT_STATUS=0 pm2 start ./scrape-xml.sh --no-autorestart -n scrape-meta-$pm2id -- project_xml_files "$1"

    # check if already running
    # pm2 jlist | jq -r '.[] | select(.name == "scrape-meta-$pm2id") | .pm2_env.status' === running
    # log fiiles
    # pm2 jlist | jq -r '.[] | select(.name == "scrape-meta-$pm2id") | .pm2_env.pm_err_log_path, .pm2_env.pm_out_log_path'

  # add to list of projects to create map vector tiles for:
  #   from each meta XML file bounding box geospatial data
  if ! grep "$1" projects/_map_tiles_projects.list 1>/dev/null 2>/dev/null; then
    echo "$1" >> projects/_map_tiles_projects.list
  fi
  # make the map tiles
  python3 map_tiles_compile.py projects/_map_tiles_projects.list simplify
}

_do $1
