import subprocess
import re
import os
import sys
import random
import json
from shapely.geometry import Polygon, Point
from datetime import datetime

def run():
    leaves_on_projects_file=open('leaves-on.txt', 'r')
    leaves_off_projects_file=open('leaves-off.txt', 'r')

    for line in leaves_on_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-', '').replace('.txt', '')
        project_name_bits=project.split('/')
        leaves_on_or_off= project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        print ('%s: %s' % (project_name, leaves_on_or_off))

if (__name__ == '__main__'):
    run(args.cmd, args)