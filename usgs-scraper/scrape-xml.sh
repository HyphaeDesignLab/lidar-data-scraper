base_dir=$(dirname $0)
cd $base_dir
. ./utils-stats.sh
. ./scrape-project-meta.sh

scrape_count=0
echo > scrape-rest.txt;
check_xml_scrape_count_and_rest() {
    scrape_count=$(expr $scrape_count + 1)

    date >> scrape-rest.txt;
    if [ "$(expr $scrape_count % 250)" = "0" ]; then
        echo 'every 250 scrapes rest 60 seconds' >> scrape-rest.txt;
        sleep 60
    elif [ "$(expr $scrape_count % 50)" = "0" ]; then
        echo 'every 50 scrapes rest 20 seconds' >> scrape-rest.txt;
        sleep 20
    elif [ "$(expr $scrape_count % 20)" = "0" ]; then
        echo 'every 20 scrapes rest 10 seconds' >> scrape-rest.txt;
        sleep 10
    elif [ "$(expr $scrape_count % 10)" = "0" ]; then
        echo 'every 10 scrapes rest 3 seconds' >> scrape-rest.txt;
        sleep 3
    elif [ "$(expr $scrape_count % 5)" = "0" ]; then
        echo 'every 5 scrapes rest 2 seconds' >> scrape-rest.txt;
        sleep 2
    else
        sleep .5
    fi
}

scrape_project_xml() {
    project=$1
    project_path="$project"
    is_in_loop=$2

    if [ ! "$is_in_loop" ]; then
        echo -n "(prj) $project: "
    fi

    subprojects=$(started_scrape $project)
    subprojects_count=$(started_scrape $project | wc -l)
    if [ "$subprojects" ]; then
        subproject_i=0
        for subproject in $subprojects; do
            subproject_i=$(expr $subproject_i + 1)
            echo -n "(subprj) $subproject ($subproject_i/$subprojects_count): "
            scrape_subproject_xml $project $subproject in_loop
        done;
    else
        if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
            echo " metadata scraping";
            scrape_project_meta_xml $project
            check_xml_scrape_count_and_rest
        else
            echo " NO metadata to scrape";
        fi
    fi
    project_info $project > projects/$project_path/_stats.txt
}

scrape_subproject_xml() {
    project=$1
    subproject=$2
    is_in_loop=$3
    project_path="$project/$subproject"

    if [ ! "$is_in_loop" ]; then
        echo -n "(subprj) $project: $subproject: "
    fi

    if [ -f projects/$project_path/_index/current/metadata_dir.txt ] && [ -f projects/$project_path/meta/_index.html ]; then
        echo " metadata scraping";
        scrape_project_meta_xml $project $subproject
        check_xml_scrape_count_and_rest
    else
        echo " metadata already scraped";
    fi
    project_info $project $subproject > projects/$project_path/_stats.txt
}


scrape_projects_xml() {

    echo "scraping projects XML files";

    projects=$(started_scrape)
    projects_count=$(started_scrape | wc -l)

    project_i=0
    for project in $projects; do
        if [ -f projects/STOP_SCRAPE.txt ]; then break; fi;

        project_i=$(expr $project_i + 1)
        echo -n "(prj) $project ($project_i/$projects_count): "
        scrape_project_xml $project in_loop
    done
    if [ -f projects/STOP_SCRAPE.txt ]; then
      rm projects/STOP_SCRAPE.txt
    fi;
}

if [ "$1" = "all" ]; then
    scrape_projects;
elif [ "$1" != "" ]; then
    if [ "$2" = "" ]; then
        scrape_project $1;
    else
        scrape_subproject $1 $2;
    fi
fi