import os
import sys
import json
from datetime import datetime
from pathlib import Path

def run():
    leaves_on_projects_file=open('leaves-on.txt', 'r')
    leaves_off_projects_file=open('leaves-off.txt', 'r')

    for line in leaves_on_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-on.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        data = get_files_data(project_name)
        print(project_name, 'on', data)


    leaves_on_projects_file.close()

    for line in leaves_off_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-off.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        data = get_files_data(project_name)
        print(project_name, 'off', data)

    leaves_off_projects_file.close()

def get_files_data(dir):
    # Create a Path object for the directory
    path = Path(dir)

    # Get the list of files in the directory
    files = path.glob('*.xml.txt')

    # Print the file names
    tiles=[]
    date_start=None
    date_end=None
    for file in files:
        if file.is_file():
            bounds = {}
            for line in file:
                line_pieces=line.split(':')
                if line_pieces[0] == 'date_start':
                    date_start=line_pieces[1]
                elif line_pieces[0] == 'date_end':
                    date_end=line_pieces[1]
                else:
                    bounds[line_pieces[0]]=float(line_pieces[1])
            polygon = [
              [bounds['west'], bounds['north']],
              [bounds['east'], bounds['north']],
              [bounds['east'], bounds['south']],
              [bounds['west'], bounds['south']]]
            tiles.push(polygon)

    return { 'tiles': tiles, 'date_start': date_start, 'date_end': date_end }


if (__name__ == '__main__'):
    run()