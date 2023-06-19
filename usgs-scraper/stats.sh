#!/bin/bash

. ./utils-stats.sh

######### MAIN  ###########

if [ "$1" = "cache_stats" ]; then
 cache_stats $2;
fi;

if [ $(has_arg size) ] || [ $(has_arg all) ]; then
 echo "size on disk: " $(du -h -d 0 .)
fi;

if [ $(has_arg general) ]; then
  echo -n 'XML downloaded: '
  xml_files_downloaded_count;
  echo -n 'XML in progress: '
  xml_file_download_in_progress;
fi

if [ $(has_arg xml_files_downloaded_count) ]; then
  echo -n 'XML downloaded: '
  xml_files_downloaded_count;
  echo -n 'XML in progress: '
  xml_file_download_in_progress;
fi
if [ $(has_arg xml_file_downloaded_vs_todownload) ]; then
  echo -n 'XML downloaded vs to-download: '
  xml_file_downloaded_vs_todownload;
fi

if [ $(has_arg disk_usage_changes) ] || [ $(has_arg general) ]; then
  du -d3 > disk_usage_changes-$(date +%s).txt
  file_count=$(ls disk_usage_changes*.txt 2>/dev/null | wc -l | xargs echo -n)
  if [ "$file_count" -gt "5" ]; then
   rm $(ls -1tr disk_usage_changes*.txt | head -1)
   ((file_count--))
  fi
  if [ "$file_count" -lt "2" ]; then
    echo 'run this again to get at least two disk usages to compare';
  else
    echo "Which disk changes would you like to compare? Pick two numbers between 1 (latest) and $file_count (earliest)"
    read -p "One: " zzz_latest;
    read -p "Two: " zzz_earliest;
    file2=$(ls -1rt disk_usage_changes*.txt | head -$zzz_latest | tail -1)
    file1=$(ls -1rt disk_usage_changes*.txt | head -$zzz_earliest | tail -1)
    diff $file1 $file2 |
     grep -E '^(<|>)' |
     grep -Ev '\.(/projects)?$' |
     sed -En -e 's/^< ([0-9]+)[^0-9].+/\1/;/^[0-9]/ {N;s/\n//g;s/([0-9]+)> ([0-9]+)(.+)$/\3:   \1 -> \2/;p;};'
  fi;
fi;

if [ $(has_arg index_errors) ] || [ $(has_arg all) ]; then
    echo -n "project Index with BAD chars: ";
    index_bad_chars | wc -l
fi
if [ $(has_arg index) ] || [ $(has_arg all) ]; then
    echo -n "projects in index: "
    project_index | wc -l
fi

if [ $(has_arg started_scrape) ] || [ $(has_arg all) ]; then
    echo -n "projects scraped: " && started_scrape | wc -l
    echo -n "projects with subprojects: " && started_scrape_with_subprojects | wc -l
fi

if [ $(has_arg not_started_scrape) ] || [ $(has_arg all) ]; then
    echo -n "projects NOT started scraping: "
    not_started_scrape | wc -l
fi

if [ $(has_arg started_scrape_not_in_index) ] || [ $(has_arg all) ]; then
    echo -n "projects started scraping NOT IN INDEX: "
    started_scrape_not_in_index $(has_arg remove_dirs) | wc -l
fi
if [ $(has_arg started_scrape_not_in_index) ]; then
    echo -n "projects + SUBprojects started scraping but WITH NO INDEX: ";
    started_scrape_no_index_or_meta | wc -l && started_scrape_subproject_not_in_index $(has_arg remove_dirs) | wc -l
    echo
fi

if [ $(has_arg meta_xml_to_download) ]; then

    echo "projects with NO XML to download $(projects_with_no_meta_xml | wc -l)"
    projects_with_no_meta_xml | sed -e 's/^/  /'
    echo "projects with XML to download $(projects_with_meta_xml | wc -l)"
    echo "SUBprojects with NO XML to download $(subprojects_with_no_meta_xml | wc -l)"
    subprojects_with_no_meta_xml | sed -e 's/^/  /'
    echo "SUBprojects with XML to download $(subprojects_with_meta_xml | wc -l)"
fi

if [ $(has_arg xml_count) ] || [ $(has_arg all) ]; then
    echo "Projects with XML: " && $(projects_with_xml_count)
    echo "XML total count: " && $(xml_files_count)
fi
if [ $(has_arg xml_data_count) ]; then
    echo "XMLs containing: $2: " && xml_data_search count $2
fi

if [ $(has_arg xml_data_search) ]; then
    echo "XMLs containing: $2: " && xml_data_search search $2
fi

if [ $(has_arg zip_count) ] || [ $(has_arg all) ]; then
    echo "Projects with ZIP files: " && projects_with_zip_count
fi

if [ $(has_arg project_info) ]; then
    echo $2 $3
    project_info $2 $3;
fi