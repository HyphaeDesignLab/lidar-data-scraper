# LIDAR DATA SCRAPER

All data is scraped from https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/

## Scrape Indeces

`scrape-index.sh "all"` will scrape indeces: 
* 
* of all USGS projects (index is saved to `projects/_index/current/index.txt`)
* of all subprojects within each project (index is saved to `projects/<project_name>/_index/current/index.txt`; subprojects are just subdirectories under `projects/<project_name>/*`)
* of all XML files within each project/subproject (`projects/<project_name>/_index/current/index.txt`)

Run the global loop, which is called this scrapes the index structure urls from projects and subprojects. Saves the urls to a metadata text file.
Then run scrape-xml.sh which does a loop through all the projects and subprojects checks the metadata index and downloads the actual xml files.
Then run "laz-xml-misc.sh get_leaves_on_off"  which reads all the xml files and extracts the project dates and tile bounding boxes  and saves them to a file to a xml.txt file, and also leave-on.txt and a leaves-off.txt which have the a one or a zero depending on if the leaves are on or off. It also makes a leaves-report.txt file in the main project folder, which has lists all the leafves on /off files in projects/subprojects folders, (it has the name of the peoject and subproject and the word on or off separated by a space. )
Then run compile-tile-map.py which creates a geojson of the tiles with leaf-on or leaf off status to each tile.
Then  a node-express server automatically serves that geojson to the webappp
