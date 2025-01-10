# a short-cut to
#   (1) scrape the entire top-level project index
#   (2) scrape the project or project/subproject index
#   (3) scrape the xml files in project or project/subproject

#  (1) all projects, force-update scrape mode, no recursion
./scrape-index.sh all force no

# (2) the project/subproject from first arg, force-update, yes-recurse
./scrape-index.sh $1 force yes

# (3)
# make sure to print full text status to STDOUT (usually it prints only last line)
#    LIDAR_SCRAPER_COMPACT_TEXT_STATUS=0
#  the command is "project_xml_files"
LIDAR_SCRAPER_COMPACT_TEXT_STATUS=0 ./scrape-xml.sh project_xml_files $1

