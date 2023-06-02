base_dir=$(dirname $0)
cd $base_dir
. ./utils-stats.sh
. ./scrape-project-index.sh
. ./scrape-project-meta.sh

scrape_count=0
check_scrape_count_and_rest() {
    scrape_count=$(expr $scrape_count + 1)

    if [ "$(expr $scrape_count % 250)" = "0" ]; then
        sleep 60
    elif [ "$(expr $scrape_count % 50)" = "0" ]; then
        sleep 20
    elif [ "$(expr $scrape_count % 20)" = "0" ]; then
        sleep 10
    elif [ "$(expr $scrape_count % 10)" = "0" ]; then
        sleep 3
    elif [ "$(expr $scrape_count % 5)" = "0" ]; then
        sleep 2
    else
        sleep .5
    fi
}

scrape_project() {
    project=$1
    project_path="$project"
    is_in_loop=$2

    if [ ! "$is_in_loop" ]; then
        echo -n "(prj) $project: "
    fi

    if [ ! -d projects/$project_path/_index/current ] || [ ! -f projects/$project_path/_index/current/index.txt ]; then
        echo " index scraping";
        scrape_project_index $project
    else
        echo " index already scraped";
    fi

    subprojects=$(project_index $project)
    subprojects_count=$(project_index $project | wc -l)
    if [ "$subprojects" ]; then
        subproject_i=0
        for subproject in $subprojects; do
            subproject_i=$(expr $subproject_i + 1)
            echo -n "(subprj) $subproject ($subproject_i/$subprojects_count): "
            scrape_subproject $project $subproject in_loop
        done;
    else
        if [ ! -f  projects/$project_path/_index/current/metadata_dir.txt ] && [ ! -f projects/$project_path/meta/_index.html ]; then
            echo " metadata scraping";
            scrape_project_meta $project
            check_scrape_count_and_rest
        else
            echo " metadata already scraped";
        fi
    fi
    project_info $project > projects/$project_path/_stats.txt
}

scrape_subproject() {
    project=$1
    subproject=$2
    is_in_loop=$3
    project_path="$project/$subproject"

    if [ ! "$is_in_loop" ]; then
        echo -n "(subprj) $project: $subproject: "
    fi

    if [ ! -d projects/$project_path/_index/current ] || [ ! -f projects/$project_path/_index/current/index.txt ]; then
        echo " index scraping";
        scrape_project_index $project $subproject
    else
        echo " index already scraped";
    fi

    if [ ! -f  projects/$project_path/_index/current/metadata_dir.txt ] && [ ! -f projects/$project_path/meta/_index.html ]; then
        echo " metadata scraping";
        scrape_project_meta $project $subproject
        check_scrape_count_and_rest
    else
        echo " metadata already scraped";
    fi
    project_info $project $subproject > projects/$project_path/_stats.txt
}


scrape_projects() {

    if [ ! -d projects/_index/current ] || [ ! -f projects/_index/current/index.txt ]; then
      echo "scraping USGS projects list";
      scrape_project_index
    fi

    projects=$(project_index)
    projects_count=$(project_index | wc -l)

    project_i=0
    for project in $projects; do
        if [ -f projects/STOP_SCRAPE.txt ]; then break; fi;
        project_line=$(grep "${project}~" projects/_index/current/index_with_year_and_state.txt)
        project_state=$(echo $project_line | sed -E -e 's/^[^~]+~([^~]+)~[^~]+~$/\1/')

        # skip states that are NOT in STATES to SCRAPE
        if  [ "$project_state" ] && [ "$project_state" != "none" ] && [ "$(grep $project_state states-to-scrape.txt)" = "" ]; then
            continue
        fi

        project_i=$(expr $project_i + 1)
        echo -n "(prj) $project ($project_i/$projects_count): "
        scrape_project $project in_loop
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