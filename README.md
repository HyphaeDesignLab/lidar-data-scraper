How to run the scraper part:
Run the global loop, which is called scrape-projects.sh "all" this scrapes the index structure urls from projects and subprojects. Saves the urls to a metadata text file.
Then run scrape-xml.sh which does a loop through all the projects and subprojects checks the metadata index and downloads the actual xml files.
Then run "laz-xml-misc.sh get_leaves_on_off"  which reads all the xml files and extracts the project dates and tile bounding boxes  and saves them to a file to a xml.txt file, and also leave-on.txt and a leaves-off.txt which have the a one or a zero depending on if the leaves are on or off. It also makes a leaves-report.txt file in the main project folder, which has lists all the leafves on /off files in projects/subprojects folders, (it has the name of the peoject and subproject and the word on or off separated by a space. )
Then run compile-tile-map.py which creates a geojson of the tiles with leaf-on or leaf off status to each tile.
Then  a node-express server automatically serves that geojson to the webappp
