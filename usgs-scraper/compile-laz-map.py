import os
import sys
import json
from datetime import datetime
from pathlib import Path

def run():
    leaves_on_projects_file=open('leaves-on.txt', 'r')
    leaves_off_projects_file=open('leaves-off.txt', 'r')

    geojson_file = open('leaves.geojson', 'w')
    geojson_file.write('{"type": "FeatureCollection", "features": [')
    is_first_line = True
    for line in leaves_on_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-on.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        get_geojson_feature_collection(project_name, 'on', geojson_file, is_first_line)
        is_first_line = False

    leaves_on_projects_file.close()

    for line in leaves_off_projects_file:
        project=line.replace('\n', '').replace('projects/', '').replace('meta/leaves-off.txt', '')
        project_name_bits=project.split('/')
        project_name_bits.pop()
        project_name='/'.join(project_name_bits)
        get_geojson_feature_collection(project_name, 'off', geojson_file)

    leaves_off_projects_file.close()

    geojson_file.write(']}')
    geojson_file.close()

def get_geojson_feature_collection(project, leaves_on_off, geojson_file, is_first_feature=False):
    dir = 'projects/'+project+'/meta/'
    # Get the list of files in the directory
    files = os.listdir(dir)
    # Print the file names
    date_start=None
    date_end=None

    bbox = { "west": None, "east": None, "north": None, "south":  None}
    project_tiles_file = open ('projects/'+project+'/xml_tiles.geojson', 'w')
    project_tiles_file.write('{"type": "FeatureCollection", "features": [')

    is_first_tile=True
    file_count=0
    for file_name in files:
        if '.xml.txt' not in file_name:
            continue
        file_count=file_count+1

    print ('%s project has %d tiles\n' % (project, file_count))

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
            elif line_pieces[0] in ['south', 'north', 'east', 'west']:
                try:
                    bounds[line_pieces[0]]=float(line_pieces[1])
                except Exception as e:
                    print ('%s has error: %s' % (file_name, e))

        if 'east' not in bounds or 'west' not in bounds or 'south' not in bounds or 'north' not in bounds:
            continue

        if bounds['west'] > 0 and bounds['south'] < 0:
            tmp = bounds['south']
            bounds['south'] = bounds['west']
            bounds['west'] = tmp
        if bounds['east'] > 0 and bounds['north'] < 0:
            tmp = bounds['north']
            bounds['north'] = bounds['east']
            bounds['east'] = tmp

        polygon = [
          [bounds['west'], bounds['north']],
          [bounds['east'], bounds['north']],
          [bounds['east'], bounds['south']],
          [bounds['west'], bounds['south']],
          [bounds['west'], bounds['north']]]

        bbox['west'] = bounds['west'] if bbox['west'] == None else min(bounds['west'], bbox['west'])
        bbox['east'] = bounds['east'] if bbox['east'] == None else max(bounds['east'], bbox['east'])
        bbox['north'] = bounds['north'] if bbox['north'] == None else max(bounds['north'], bbox['north'])
        bbox['south'] = bounds['south'] if bbox['south'] == None else min(bounds['south'], bbox['south'])

        project_tiles_file.write( ('' if is_first_tile else ',' ) + json.dumps({
           "type": "Feature",
           "geometry": {
             "type": "Polygon",
             "coordinates": [polygon]
           },
           "properties": {
             "is_bbox": False,
             "project": project,
             "date_start": date_start,
             "date_end": date_end,
             "leaves": leaves_on_off
           }
         }))

        is_first_tile=False

    project_tiles_file.write(']}')
    project_tiles_file.close()

    geojson_file.write( ('' if is_first_feature else ',' ) + json.dumps({
               "type": "Feature",
               "geometry": {
                 "type": "Polygon",
                 "coordinates": [[
                   [bbox['west'], bbox['north']],
                   [bbox['east'], bbox['north']],
                   [bbox['east'], bbox['south']],
                   [bbox['west'], bbox['south']],
                   [bbox['west'], bbox['north']]
                ]]
               },
               "properties": {
                 "tile_count": file_count,
                 "is_bbox": True,
                 "project": project,
                 "date_start": date_start,
                 "date_end": date_end,
                 "leaves": leaves_on_off
               }
             }))

def get_polygon_union(polygons):
    import geopandas as gpd
    from shapely.ops import unary_union

    # Example polygons
    polygons = [
        Polygon([(0, 0), (1, 0), (1, 1)]),
        Polygon([(1, 1), (2, 1), (2, 2)]),
        Polygon([(2, 2), (3, 2), (3, 3)]),
    ]

    # Create GeoDataFrame
    gdf = gpd.GeoDataFrame(geometry=polygons)

    # Union operation
    union_polygon = gdf.unary_union

    # Create new GeoDataFrame for the union polygon
    gdf_union = gpd.GeoDataFrame(geometry=[union_polygon])

    # Print the union polygon
    print(gdf_union)

if (__name__ == '__main__'):
    run()