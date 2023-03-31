
import os
import sys
sys.path.append(os.path.dirname(os.path.realpath(__file__)) + '/..')

import json
from scrape import projects_list_compare


old_proj = {
    "p1_updated": {"dateModified": "2022-06-28 08:45"},
    "p3_removed": {"dateModified": "2023-03-22 14:18"},
    "p4": {"dateModified": "2022-06-06 09:43"},
}
new_proj = {
    "p1_updated": {"dateModified": "2022-07-28 08:45"},
    "p2_new": {"dateModified": "2023-03-22 14:18"},
    "p4": {"dateModified": "2022-06-06 09:43"},
}
changes = projects_list_compare(new_proj, old_proj)
print(changes)
print(json.dumps(new_proj, sort_keys=True, indent=4))

