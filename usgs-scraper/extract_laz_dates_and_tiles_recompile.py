import os
import sys
import json
import time
from datetime import datetime

import numpy as np
import laspy

from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.ops import unary_union
import geopandas
import subprocess

import requests

def get_env(env_file_path=None):
    env = {}
    if env_file_path == None:
        # look for .env inside same directory as script itself
        dir = os.path.dirname(sys.argv[0])
        if dir:
            env_file_path = dir + '/.env'
        else:
            env_file_path = '.env'

    if os.path.isfile(env_file_path):
        file = open(env_file_path, 'r')
        for line in file:
            if not '=' in line:
                continue
            (key, value) = line.replace('\n', '').split('=')
            key = key.strip()
            if key[0] == '#':
                continue
            value = value.strip()
            if key in env:
                if type(env[key]) == list:
                    env[key].append(value)
                else:
                    env[key] = [env[key], value]
            else:
                env[key] = value
    return env
env = get_env(sys.argv[1] if len(sys.argv) > 1 else None)

def run(list_file_name='list.txt'):
    # open LAZ URL download list
    list_file=open(list_file_name, 'r')

    # extract project/subrpoject string = project ID
    # save array of LAZ filenames per project ID in a hash
    project_lazs_by_id = {}
    for line in list_file:
        line = line.replace('\n', '').replace('https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects/', '')
        line_pieces = line.split('/')
        laz_file_name = line_pieces.pop()
        laz_dir_name = line_pieces.pop()
        if not '/'.join(line_pieces) in project_lazs_by_id:
            project_lazs_by_id['/'.join(line_pieces)] = []
        project_lazs_by_id['/'.join(line_pieces)].append(laz_file_name)

    # build a list curl commands to download map_tile downloads for each project ID from Lidar server
    tile_json_download_cmds = []
    tile_json_url_base = env['server_url'] + env['projects_url_path']
    for project_id in project_lazs_by_id:
        # since multiple project/subproject files get downloaded in same dir (for current download job)
        #   make sure to preserve project---subproject IDs in map-tile file name
        project_id_without_slashes = project_id.replace('/', '---')
        # run curl and save to JSON file
        tile_json_download_cmds.append(f'curl -o {project_id_without_slashes}.json {tile_json_url_base}/{project_id}/map_tiles.json')

    # run all commands
    subprocess.check_output(' && '.join(tile_json_download_cmds), shell=True)

    # loop on all LAZ files in each project/subproject and extract dates
    for project_id in project_lazs_by_id:
        project_id_without_slashes = project_id.replace('/', '---')
        map_tile_geojson_file = open(project_id_without_slashes+'.json')
        map_tile_geojson_obj = json.load(map_tile_geojson_file)
        map_tile_geojson_file.close()
        for laz_file_name in project_lazs_by_id[project_id]:
            laz_scan_dates_obj = laz_extract_data(laz_file_name)

            project_id_parts = project_id.split('/')

            laz_file_name_abbreviated_no_ext = laz_file_name.replace('USGS_LPC_', '{u}').replace(project_id_parts[0], '{prj}').replace('.laz', '')
            if len(project_id_parts) > 1:
                laz_file_name_abbreviated_no_ext = laz_file_name_abbreviated_no_ext.replace(project_id_parts[1], '{sprj}')

            for feature in map_tile_geojson_obj['features']:
                # ignore JSON tiles that do not match the current LAZ tile
                if feature['properties']['laz_tile'] != laz_file_name_abbreviated_no_ext:
                    continue
                print(feature['properties']['laz_tile'], laz_scan_dates_obj, feature['properties']['date_start'], feature['properties']['date_end'])
                feature['properties']['date_project_start'] = feature['properties']['date_start']
                feature['properties']['date_start'] = laz_scan_dates_obj['date_start']
                feature['properties']['date_project_end'] = feature['properties']['date_end']
                feature['properties']['date_end'] = laz_scan_dates_obj['date_end']

        map_tile_geojson_file = open(project_id_without_slashes+'.new.json', 'w')
        json.dump(map_tile_geojson_obj, map_tile_geojson_file)
        map_tile_geojson_file.close()
        requests.post(env['server_url'] + env['tiles_edit_url_path'], data={'secret': env['secret'], 'json': json.dumps(map_tile_geojson_obj), 'project': project_id })
    # /end-for-loop


def laz_extract_data(file_path, point_limit=0):
    # Buffered read to extract all dates of individual points
    #  (buffered so that we do not need HUGE RAM and costly VMs)

    date_start=None
    date_end=None
    with laspy.open(file_path) as f:

      i = point_limit
      for point in f.chunk_iterator(500):
        gps_times = list(point.point_format.dimension_names)
        gps_times_index = gps_times.index('gps_time')
        #gps_time is often used in the laz 1.4 standard. However, the lidar operator may do something weird here so be careful!
        #actually it is always a bit weird: The gps_time is seconds since January 6th 1980 minus 1 billion. So to get a unix timestamp we do the following:
        unix_time = point.gps_time[0]+1000000000+315964782

        if date_start == None:
          date_start = unix_time
        if date_end == None:
          date_end = unix_time

        date_start = min(date_start, unix_time)
        date_end = max(date_end, unix_time)

        i = i - 1
        if point_limit > 0 and i <= 0:
          break

    return {
        'date_start': datetime.fromtimestamp(date_start).strftime('%Y%m%d%H%M%S'), #now turn the unix timstamp to a local timestamp:
        'date_end': datetime.fromtimestamp(date_end).strftime('%Y%m%d%H%M%S')
    }
if (__name__ == '__main__'):
    run()