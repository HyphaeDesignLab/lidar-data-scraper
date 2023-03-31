
import os
import sys
sys.path.append(os.path.dirname(os.path.realpath(__file__)) + '/..')

import json
from scrape import projects_list_get

projects = projects_list_get()

for p in projects['data']:
    if 'hasDownloads' in projects['data'][p]:
        print(p)