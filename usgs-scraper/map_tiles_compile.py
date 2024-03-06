import os
import sys
import re
import json
from datetime import datetime
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union
import geopandas
import time
import subprocess

# make sure we are in the right directory
os.chdir(os.path.dirname(__file__))

def get_arg(expected_index, exit_if_unset=False, error_message='Error'):
    if len(sys.argv) >= expected_index + 1 and sys.argv[expected_index]:
        return sys.argv[expected_index]

    if not exit_if_unset:
        return False

    print (error_message)
    sys.exit(0)


# arg 1 is always the python script itself
def get_input_file_arg(error_message):
    return get_arg(1, True, error_message)

def get_simplify_flag_arg():
    return get_arg(2)

def get_simplify_level_arg():
    return get_arg(3)

def run():
    input_file = get_input_file_arg(error_message=f'must provide one argument containing the list of project folders to compile map tiles from')

    if not os.path.isfile(input_file):
        print (f'the list of project folders to compile map tiles from DOES NOT EXIST')
        sys.exit(0)
        return

    project_dirs_file=open(input_file, 'r')

    all_tiles_filepath = 'projects/map_tiles.json'
    all_tiles_file = open(all_tiles_filepath, 'w')
    all_tiles_file.write('{"type": "FeatureCollection", "features": [\n')
    all_tiles_file.close()

    subprocess.check_output(f'', shell=True)

    is_first_project=True
    for line in project_dirs_file:
        project=line.replace('\n', '').strip()
        if project == '' or project == None:
            continue
        project_tiles_union_filepath = 'projects/'+project+'/map_tiles_union.json'
        if not os.path.isfile(project_tiles_union_filepath):
            get_geojson_feature_collection_for_project(project)
        else:
            print ('\n%s project tiles already exist, not re-creating' % (project))

        if os.path.isfile(project_tiles_union_filepath):
            if not is_first_project:
                subprocess.check_output(f'echo "," >> {all_tiles_filepath}', shell=True)
            is_first_project=False
            subprocess.check_output(f'cat {project_tiles_union_filepath} >> {all_tiles_filepath}', shell=True)

    project_dirs_file.close()

    all_tiles_file = open(all_tiles_file.name, 'a')
    all_tiles_file.write(']}')
    all_tiles_file.close()

def get_geojson_feature_collection_for_project(project):
    r = re.compile('^(projects/+|.*/projects/+)') # remove *projects/ prefix
    project = re.sub(r, '', project)
    if not os.path.isdir(f'projects/{project}'):
        print(f'projects/{project} is not a directory')
        return
    project_pieces = project.split('/')

    start_time = time.time()
    meta_dir = 'projects/'+project+'/meta'
    laz_dir = 'projects/'+project+'/laz'

    # LAZ URL
    laz_url_dir_name=None
    laz_dir_name_file_name = 'projects/'+project+'/_index/current/laz_dir.txt'
    if os.path.isfile(laz_dir_name_file_name):
        laz_dir_name_file=open(laz_dir_name_file_name)
        laz_url_dir_name = laz_dir_name_file.read().replace('\n', '')
        laz_dir_name_file.close()

    project_date_start=None
    project_date_end=None
    
    project_tiles_union = None
    project_tiles_arr = []
    project_tiles_file = open ('projects/'+project+'/map_tiles.json', 'w')
    project_tiles_file.write('{"type": "FeatureCollection", "features": [')

    is_first_tile=True
    xml_file_count=0
    xml_file_count_actual = 0 # when we try to open/read files, count if files exist

    # Get the list of XML files and count
    #   NOTE: the XML list contains file names abbreviated and without .xml extension
    #         abbreciations are '{u}' the common file prefix "USGS_LPC", {prj} the project name and {sprj} the subproject name
    xml_files_list_filename = meta_dir+'/_index/current/xml_files.txt'
    xml_files_list_file = open(xml_files_list_filename)
    for file_name in xml_files_list_file:
        xml_file_count=xml_file_count+1
    print ('\n%s project has %d listed tiles' % (project, xml_file_count))

    # respective LAZ files details (size and date modified) from web scrape
    laz_details = {'size':'', 'date_modified':''}
    laz_files_list_filename = laz_dir+'/_index/current/files_details.txt'
    if os.path.isfile(laz_files_list_filename):
        laz_files_list_file = open(laz_files_list_filename)
        for line_details in laz_files_list_file:
            line_details = line_details.replace('\n', '')
            laz_details_i = line_details.split('~')
            laz_details[laz_details_i[0]] = { 'size':  laz_details_i[2], 'date_modified':  laz_details_i[1] }

    # Sum-aggregate the deltas of each tile x or y: that is the difference between x1 and x0 or y1 and y0
    #   so that we can find the average delta at the end and offer a simplication factor for the resulting all-tile union polygon
    tile_xy_delta_sum = 0
    xml_files_list_file.seek(0)

    # START: foreach TILE
    for file_name_no_extension_abbreviated in xml_files_list_file:
        file_name_no_extension_abbreviated = file_name_no_extension_abbreviated.replace('\n', '')
        file_name_no_extension = file_name_no_extension_abbreviated.replace('{u}', 'USGS_LPC_').replace('{prj}', project_pieces[0])
        if len(project_pieces) > 1 and '{sprj}' in file_name_no_extension:
            file_name_no_extension = file_name_no_extension.replace('{sprj}', project_pieces[1])

        bounds = {}

        #  get the xml.txt file (which the text summary of the full XML file)
        xml_txt_file_path = meta_dir+'/'+file_name_no_extension + '.xml.txt'
        if not os.path.isfile(xml_txt_file_path):
            continue
        
        xml_file=open(xml_txt_file_path)

        tile_date_start =None
        tile_date_end = None
        is_xml_file_empty=True
        for line in xml_file:
            line=line.replace('\n', '').strip()

            if not line:
                continue
            is_xml_file_empty=False

            line_pieces=line.split(':')
            if line_pieces[0] == 'date_start':
                tile_date_start=line_pieces[1]
            elif line_pieces[0] == 'date_end':
                tile_date_end=line_pieces[1]
            elif line_pieces[0] in ['south', 'north', 'east', 'west']:
                try:
                    bounds[line_pieces[0]]=float(line_pieces[1])
                except Exception as e:
                    print ('%s XML TXT has error: %s' % (file_name_no_extension, e))
        if is_xml_file_empty:
            continue
        xml_file.close()

        #  get the laz.txt file (which the text summary of the full LAZ file)
        #   those LAZ TXT files might have been run elsewhere and want to protect them
        #     and not merge them with the XML TXT ones
        #     but merge them here:  MOSTLY MERGING DATES (LAZ TXT dates override XML TXT dates as more accurate)
        laz_txt_file_path = laz_dir+'/'+file_name_no_extension + '.laz.txt'
        if os.path.isfile(laz_txt_file_path):
            laz_file=open(laz_txt_file_path)
            for line in laz_file:
                line=line.replace('\n', '').strip()

                if not line:
                    continue

                line_pieces=line.split(':')
                if line_pieces[0] == 'date_start':
                    tile_date_start=line_pieces[1]
                elif line_pieces[0] == 'date_end':
                    tile_date_end=line_pieces[1]

        if project_date_start == None:
            project_date_start = tile_date_start[0:4+2+2]
        elif int(tile_date_start[0:4+2+2]) <= int(project_date_start):
            project_date_start = tile_date_start[0:4+2+2]

        if project_date_end == None:
            project_date_end = tile_date_end[0:4+2+2]
        elif int(tile_date_end[0:4+2+2]) >= int(project_date_end):
            project_date_end = tile_date_end[0:4+2+2]

        if 'east' not in bounds or 'west' not in bounds or 'south' not in bounds or 'north' not in bounds:
            print ('missng east/west/south/north bounds: %s' % (file_name_no_extension))
            continue

        # Correct for raw data errors
        # sometimes west-east are swapped with south-north (?!?!)
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
          [bounds['west'], bounds['north']]
        ]

        # Assumption: each tile is roughly a square oriented perfectly with North/South West/East
        # find the larger of the tile x or y delta
        tile_xy_delta = max(abs(polygon[0][0]-polygon[1][0]), abs(polygon[1][1]-polygon[2][1]))
        tile_xy_delta_sum = (tile_xy_delta_sum if tile_xy_delta_sum else 0) + tile_xy_delta

        xml_file_count_actual = xml_file_count_actual + 1
        # save tiles in array;  save each tile with a BUFFER of 1/3 of its delta
        project_tiles_arr.append(Polygon(polygon).buffer(tile_xy_delta/3))

        # DEPRECATED, but an ALTERNATE: running Polygon.union() function on every polygon
        #   HOWEVER: IT CAN GET SLOW with too many polygons
        # do tiles union
        # if project_tiles_union is None:
        #     project_tiles_union = Polygon(polygon)
        # else:
        #     project_tiles_union = project_tiles_union.union(Polygon(polygon))

        project_tiles_file.write( ('' if is_first_tile else ',' ) + json.dumps({
           "type": "Feature",
           "geometry": {
             "type": "Polygon",
             "coordinates": [polygon]
           },
           "properties": {
             "date_start": tile_date_start,
             "date_end": tile_date_end,
             "leaves": are_leaves_on_or_off(tile_date_start[0:4+2+2], tile_date_end[0:4+2+2]),
             "laz_tile": file_name_no_extension_abbreviated if file_name_no_extension_abbreviated in laz_details else '',
             "laz_size": laz_details[file_name_no_extension_abbreviated]['size'] if file_name_no_extension_abbreviated in laz_details else ''
           }
         }))

        is_first_tile=False
    # END: foreach TILE

    project_tiles_file.write(']}')
    project_tiles_file.close()

    xml_files_list_file.close()

    # Debug info
    print ('\n  %d existing tiles (of %d listed)' % (xml_file_count_actual, xml_file_count))

    # if no actual xml file/tiles were found and processed just return
    if not xml_file_count_actual:
        print ('  no actual downloaded tiles... skipping')
        return
    
    # Get averages
    tile_xy_average_delta = tile_xy_delta_sum / xml_file_count_actual

    # Do ALL tile union
    project_tiles_union = unary_union(project_tiles_arr)

    # if Simply flag is on
    if get_simplify_flag_arg() == 'simplify':
        #  specify simplify tolerance in arg (optional)
        simplify_tolerance_multiplier = float(get_simplify_level_arg())
        if not simplify_tolerance_multiplier:
            simplify_tolerance_multiplier = 0.5
        # else level is HALF * tile_xy_average_delta
        simplify_tolerance = simplify_tolerance_multiplier * tile_xy_average_delta



        # simplify
        # https://geopandas.org/en/stable/docs/reference/api/geopandas.GeoSeries.simplify.html
        project_tiles_union = geopandas.GeoSeries(project_tiles_union).simplify(simplify_tolerance)

        # turn into a string-able JSON
        project_tiles_union = json.loads(geopandas.GeoDataFrame(geometry=project_tiles_union).to_json())['features'][0]['geometry']
    else:
        # turn into a string-able JSON
        project_tiles_union = mapping(project_tiles_union)

    print (f'  project tiles union = type: {project_tiles_union["type"]}, verteces: {len(project_tiles_union["coordinates"][0] if project_tiles_union["type"] == "Polygon" else project_tiles_union["coordinates"][0][0] )}')

    project_tiles_union_file = open ('projects/'+project+'/map_tiles_union.json', 'w')
    project_tiles_union_file.write(json.dumps({
               "type": "Feature",
               "geometry": project_tiles_union,
               "properties": {
                 "tile_count": xml_file_count_actual,
                 "project": project,
                 "laz_url_dir": laz_url_dir_name,
                 "date_start": project_date_start,
                 "date_end": project_date_end,
                 "leaves": are_leaves_on_or_off(project_date_start, project_date_end)
               }
             }))
    project_tiles_union_file.close()

    end_time = time.time()
    total_time = round(end_time - start_time, 1)
    print(f'  done... in {total_time} seconds')

def are_leaves_on_or_off(date_start, date_end):
    if int(date_start[0:4]) == int(date_end[0:4]):
        if int(date_start[4:]) >= 501 and int(date_end[4:]) <= 930:
            return 'on'
        elif int(date_end[4:]) <= 331 or int(date_start[4:]) >= 1101:
            return 'off'
        else:
            return 'mixed'
    elif  int(date_end[0:4]) - int(date_start[0:4]) == 1:
        if int(date_start[4:]) >= 1101 and int(date_end[4:]) <= 331:
            return 'off'
        else:
            return 'mixed'
    return 'mixed'

if (__name__ == '__main__'):
    run()