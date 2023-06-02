#!/bin/bash

. ./utils-stats.sh

######### MAIN  ###########

if [ "$1" = "cache_stats" ]; then
 cache_stats $2;
fi;

if [ $(has_arg size) ] || [ $(has_arg all) ]; then
 echo "size on disk: " $(du -h -d 0 .)
fi;

if [ $(has_arg index_errors) ] || [ $(has_arg all) ]; then
    echo -n "project Index with BAD chars: ";
    index_bad_chars | get_line_count
    echo
fi
if [ $(has_arg index) ] || [ $(has_arg all) ]; then
    echo -n "projects in index: "
    project_index | get_line_count
    echo
fi

if [ $(has_arg started_scrape) ] || [ $(has_arg all) ]; then
    echo -n "projects started scraping: "
    started_scrape | get_line_count
    echo
fi

if [ $(has_arg not_started_scrape) ] || [ $(has_arg all) ]; then
    echo -n "projects NOT started scraping: "
    not_started_scrape | get_line_count
    echo
fi

if [ $(has_arg started_scrape_not_in_index) ] || [ $(has_arg all) ]; then
    echo -n "projects started scraping NOT IN INDEX: "
    started_scrape_not_in_index $(has_arg remove_dirs) | get_line_count
    echo
fi
if [ $(has_arg started_scrape_not_in_index) ]; then
    echo -n "projects + SUBprojects started scraping but WITH NO INDEX: ";
    started_scrape_no_index_or_meta | get_line_count
    started_scrape_subproject_not_in_index $(has_arg remove_dirs) | get_line_count
    echo
fi

if [ $(has_arg meta_xml_to_download) ]; then

    echo "projects with NO XML to download $(projects_with_no_meta_xml | get_line_count)"
    projects_with_no_meta_xml | sed -e 's/^/  /'
    echo "projects with XML to download $(projects_with_meta_xml | get_line_count)"
    echo "SUBprojects with NO XML to download $(subprojects_with_no_meta_xml | get_line_count)"
    subprojects_with_no_meta_xml | sed -e 's/^/  /'
    echo "SUBprojects with XML to download $(subprojects_with_meta_xml | get_line_count)"
fi

if [ $(has_arg project_info) ]; then
    echo $2 $3
    project_info $2 $3;
fi