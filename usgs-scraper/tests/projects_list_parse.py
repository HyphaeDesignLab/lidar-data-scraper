import re


regex = re.compile('<img[^>]+alt="\[DIR\]">\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)
# <img src="/icons/folder.gif" alt="[DIR]"> <a href="WI_Statewide_2021_B21/">WI_Statewide_2021_B21/</a>  2023-02-10 11:13 -

projects = {}

# open sample HTML from source of  https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/
file = open('projects_list_get.html')
file.seek(0)
for line in file:
  match = regex.search(line)
  if match != None:
    projects[match.group(1).replace('/', '')] = match.group(2)

print(projects)
