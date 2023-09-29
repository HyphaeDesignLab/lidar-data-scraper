#!/bin/bash

base_url="https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/"
output_dir="scraped_data"

# Function to scrape a directory recursively
scrape_directory() {
    local url="$1"
    local output_dir="$2"

    # Create output directory if it doesn't exist
    mkdir -p "$output_dir"

    # Scrape the current directory
    curl -sfL "$url" > "$output_dir/$(basename "$url")"

    # Scrape subdirectories
    local links=$(curl -sfL "$url" | grep -Eo '<a href="[^"]+' | sed -e 's/<a href="//')
    for link in $links; do
        local sub_url="${url%/}/$link"
        if [[ "$link" != ".." ]] && [[ "$link" != "Parent Directory" ]]; then
            scrape_directory "$sub_url" "$output_dir/$link"
        fi
    done
}

# Create output directory
mkdir -p "$output_dir"

# Scrape the base URL recursively
scrape_directory "$base_url" "$output_dir"

# Count XML files with date ranges within 60 days
xml_files=$(find "$output_dir" -type f -name "*.xml")
count=0
for file in $xml_files; do
    date_range=$(grep -Eo '<(begdate|enddate)>[0-9]{4}-[0-9]{2}-[0-9]{2}</(begdate|enddate)>' "$file")
    if [[ "$date_range" =~ [0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
        begdate=$(date -d "${BASH_REMATCH[0]}" +%s)
        enddate=$(date -d "${BASH_REMATCH[1]}" +%s)
        diff=$(( (enddate - begdate) / (60*60*24) ))
        if (( diff <= 60 )); then
            (( count++ ))
        fi
    fi
done

echo "Number of XML files with date ranges within 60 days: $count"
