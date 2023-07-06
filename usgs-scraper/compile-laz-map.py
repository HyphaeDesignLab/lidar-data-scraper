import os
import sys
import json
from datetime import datetime
from pathlib import Path

def run():
    leaves_on_projects_file=open('leaves-on.txt', 'r')
    leaves_off_projects_file=open('leaves-off.txt', 'r')

    feature_tiles = []
    for line in leaves_on_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-on.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        get_geojson_feature_collection(project_name, 'on', feature_tiles)

    leaves_on_projects_file.close()

    for line in leaves_off_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-off.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        get_geojson_feature_collection(project_name, 'off', feature_tiles)

    leaves_off_projects_file.close()

    geojson_file = open('leaves.geojson', 'w')
    geojson_file.write(json.dumps({"type": "FeatureCollection", "features": feature_tiles}))
    geojson_file.close()

def get_geojson_feature_collection(project, leaves_on_off, feature_tiles):
    dir = 'projects/'+project+'/meta/'
    # Get the list of files in the directory
    files = os.listdir(dir)
    # Print the file names
    date_start=None
    date_end=None
    for file_name in files:
        if '.xml.txt' not in file_name:
            continue
        bounds = {}
        file=open(dir+file_name, 'r')
        for line in file:
            line=line.replace('\n', '')
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
          [bounds['west'], bounds['south']],
          [bounds['west'], bounds['north']]]

        feature_tiles.append({
           "type": "Feature",
           "geometry": {
             "type": "Polygon",
             "coordinates": [polygon]
           },
           "properties": {
             "project": project,
             "date_start": date_start,
             "date_end": date_end,
             "leaves": leaves_on_off
           }
         })

    return feature_tiles

if (__name__ == '__main__'):
    run()