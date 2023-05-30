base_dir=$(dirname $0)
cd $base_dir

if [ ! -d projects/_index/current ] || [ ! -f projects/_index/current/index.txt ]; then
  echo "Scraping projects list";
  ./scrape-project-index.sh
fi

projects_count=$(wc -l projects/_index/current/index.txt | sed -E -e 's/^ *([0-9]+) *.*/\1/')
projects=$(cat projects/_index/current/index.txt | sed -E -e 's/^([^~]+).+/\1/' | head -100 | xargs echo -n)

echo
echo "Scraping USGS PROJECTS!"

scrape_count=0
check_scrape_count_and_rest() {
  scrape_count=$(expr $scrape_count + 1)
  if [ "$(expr $scrape_count % 250)" = "0" ]; then
    echo "  scrape #$scrape_count / resting every 50 scrapes"
    sleep 20
  elif [ "$(expr $scrape_count % 50)" = "0" ]; then
    echo "  scrape #$scrape_count / resting every 250 scrapes"
    sleep 10
  else
    sleep 1
  fi
}
project_i=0
for project in $projects; do
  project_i=$(expr $project_i + 1)
  echo
  echo "==========  $project (project $project_i of $projects_count) ============"
  if [ ! -d projects/$project/_index/current ] || [ ! -f projects/$project/_index/current/index.txt ]; then
    echo " Scraping ...";
    ./scrape-project-index.sh $project
  fi
  subprojects_count=$(wc -l projects/$project/_index/current/index.txt | sed -E -e 's/^ *([0-9]+) *.*/\1/')
  subprojects=$(cat projects/$project/_index/current/index.txt | sed -E -e 's/^([^~]+).+/\1/' | xargs echo -n)
  if [ "$subprojects" ]; then
    echo ' Subprojects: ';
    subproject_i=0
    for subproject in $subprojects; do
      subproject_i=$(expr $subproject_i + 1)
      echo " -----  $subproject (subproject $subproject_i of $subprojects_count) ------"
      if [ ! -d projects/$project/$subproject/_index/current ] || [ ! -f projects/$project/$subproject/_index/current/index.txt ]; then
        echo "  Scraping ...";
        ./scrape-project-index.sh $project $subproject
        check_scrape_count_and_rest
      fi
      if [ -f  projects/$project/$subproject/_index/current/metadata_dir.txt ] && [ ! -f projects/$project/$subproject/meta/_index.html ]; then
        echo "  Scraping subproject metadata";
        ./scrape-project-meta.sh $project $subproject
        check_scrape_count_and_rest;
      fi
    done;

  else
    if [ -f  projects/$project/_index/current/metadata_dir.txt ] && [ ! -f projects/$project/meta/_index.html ]; then
      echo " Scraping project metadata";
      ./scrape-project-meta.sh $project
      check_scrape_count_and_rest
    fi
  fi
done


echo
echo