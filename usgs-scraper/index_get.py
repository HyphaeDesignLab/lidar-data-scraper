import subprocess
import re
import os
import sys
import random
import json
from shapely.geometry import Polygon
from datetime import datetime

usgs_url_base = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects'

downloads_dir = '_downloads'

def get_downloads_dir(project_name, project_dataset):
    dir_path = '%s/%s__%s' % (downloads_dir, project_name, project_dataset)
    if not os.path.isdir(dir_path):
       os.makedirs(dir_path)
    return dir_path

def download_meta_index(project_name, project_dataset, index_filename_custom=None):
    index_filename = get_downloads_dir(project_name, project_dataset) + '/'
    if index_filename_custom != None:
      index_filename += index_filename_custom
    else:
      index_filename += 'meta_index_%s__%d.html' % (
        datetime.now().strftime('%y_%m_%d_%H_%M_%S'),
        random.randint(1000,10000-1))

    index_url = '%s/%s/%s/metadata/' % (usgs_url_base, project_name, project_dataset)

    cmd = "wget -S --quiet -t 13 -O %s %s " % (index_filename, index_url)
    wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    wget_process_out = str(wget_process.communicate()[0], 'utf-8')
    if wget_process_out == None or wget_process_out == '':
      print('did not fetch xml index')
      return None

    return index_filename

def download_meta_files(index_filename, project_name, project_dataset, limit=4):
    xml_regex = re.compile('(?<=\>)[\w\.\-]+\.xml', re.IGNORECASE)
    ## TEST
    ##match = xml_regex.search('asdasd>a_a.xml asdas')
    ##print(match)

    dir_path = get_downloads_dir(project_name, project_dataset)
    index_file = open(dir_path + '/' + index_filename)
    index_file.seek(0)

    meta_filenames = []
    meta_filenames_status = []
    for line in index_file:
      match = xml_regex.search(line)
      if match != None:
        meta_filenames.append(match.group(0))

    i = 0
    for meta_filename in meta_filenames:
      status = 'in progress'
      meta_url = '%s/%s/%s/metadata/%s' % (usgs_url_base, project_name, project_dataset, meta_filename)
      cmd = "wget -S --quiet -t 13 -O %s/%s %s " % (dir_path, meta_filename, meta_url)
      wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
      wget_process_out = str(wget_process.communicate()[0], 'utf-8')

      status = 'fetched'
      if wget_process_out == None or wget_process_out == '':
        status = 'failed fetch'
        # TODO: log miss

      meta_filenames_status.append( '%s (%s)' % (status, meta_filename) )
      i = i + 1

      # Testing
      if limit > 0 and i > limit:
       break

    return meta_filenames

def extract_bounds_and_date(filename):
    file_obj = open(filename)
    file_obj.seek(0)

    date_seen = False
    date_extracted = False
    bounds_seen = False
    bounds_extracted = False

    dates = []
    bounds = {}

    for line in file_obj:
      if (not date_seen and not date_extracted) or line.find('<rngdates>') >= 0:
        date_seen = True

      if not date_extracted and line.find('<begdate>') >=0:
        dates.append(line.replace('<begdate>', '').replace('</begdate>', '').strip())
      if not date_extracted and line.find('<enddate>') >=0:
        dates.append(line.replace('<enddate>', '').replace('</enddate>', '').strip())

      if date_seen and len(dates) == 2:
        date_extracted = True


      if (not bounds_seen and not bounds_extracted) or line.find('<rngdates>') >= 0:
        bounds_seen = True

      if not bounds_extracted and line.find('<westbc>') >=0:
        bounds['w'] = float(line.replace('<westbc>', '').replace('</westbc>', '').strip())
      if not bounds_extracted and line.find('<eastbc>') >=0:
        bounds['e'] = float(line.replace('<eastbc>', '').replace('</eastbc>', '').strip())
      if not bounds_extracted and line.find('<northbc>') >=0:
        bounds['n'] = float(line.replace('<northbc>', '').replace('</northbc>', '').strip())
      if not bounds_extracted and line.find('<southbc>') >=0:
        bounds['s'] = float(line.replace('<southbc>', '').replace('</southbc>', '').strip())

      if bounds_seen and len(bounds.keys()) == 4:
        bounds_extracted = True

    if len(bounds.keys()) < 4:
      # TODO: log miss
      return None

    bounds_bbox = [
      [bounds['w'], bounds['n']],
      [bounds['e'], bounds['n']],
      [bounds['e'], bounds['s']],
      [bounds['w'], bounds['s']]]

    return (bounds_bbox, dates)


def is_lidar_scan_overlap_with_city(lidar_polygon, city_multi_polygon):
    p1 = Polygon(lidar_polygon)
    is_intersects = False
    for polygon_i in city_multi_polygon:
        p2 = Polygon(polygon_i[0]) # take the first "shell" polygon (and not the subsequent "holes")
        is_intersects = is_intersects or p1.intersects(p2)

    return is_intersects


def get_city_polygon(city_id):
    file_obj = open('../cities/%s.json' % city_id)
    bounds = json.loads(file_obj.read())
    multipolygon = bounds.get('geometries')[0].get('coordinates')
    return multipolygon

def find_overlapping_lidar_scans(project_name, project_dataset, city_id):
    city_multi_polygon = get_city_polygon(city_id)

    dir_path = get_downloads_dir(project_name, project_dataset)
    file_list = os.listdir(dir_path)

    file_bounds_and_date = {}
    for f in file_list:
      if f.find('.xml') < 0:
        continue
      bounds_and_date = extract_bounds_and_date(dir_path + '/' + f)
      if bounds_and_date != None:
        if is_lidar_scan_overlap_with_city(bounds_and_date[0], city_multi_polygon):
          file_bounds_and_date[f] = bounds_and_date

    return file_bounds_and_date

def testit(test):
    sample_project_name = 'CA_NoCAL_3DEP_Supp_Funding_2018_D18'
    sample_project_dataset = 'CA_NoCAL_Wildfires_B5b_2018'
    sample_meta_index = 'meta_index_23_03_01_12_29_46__6407.html'
    sample_meta = 'USGS_LPC_CA_NoCAL_3DEP_Supp_Funding_2018_D18_w2215n1973.xml'
    sample_city_id = 'richmond-ca'
    sample_lidar_polygon = [
       (-122.3583707, 37.9432179),
       (-122.3583707, 37.9422179),
       (-122.3573707, 37.9422179),
       (-122.3573707, 37.9432179)]

    out = 'select a test'
    if test == 'get_downloads_dir':
        out = get_downloads_dir(sample_project_name, sample_project_dataset)
    elif test == 'download_meta_index':
        download_meta_index(sample_project_name, sample_project_dataset)
    elif test == 'download_meta_files':
        out = download_meta_files(sample_meta_index, sample_project_name, sample_project_dataset, -1)
    elif test == 'list_downloads_dir':
        out = os.listdir(get_downloads_dir(sample_project_name, sample_project_dataset))
    elif test == 'extract_bounds_and_date':
        out = extract_bounds_and_date(get_downloads_dir(sample_project_name, sample_project_dataset)+'/'+sample_meta)
    elif test == 'get_city_polygon':
        out = get_city_polygon(sample_city_id)
    elif test == 'is_lidar_scan_overlap_with_city':
        out = is_lidar_scan_overlap_with_city(
          extract_bounds_and_date(
           get_downloads_dir(sample_project_name, sample_project_dataset)+'/'+sample_meta)[0],
           get_city_polygon(sample_city_id))
    elif test == 'find_overlapping_lidar_scans':
        out = find_overlapping_lidar_scans(
                sample_project_name, sample_project_dataset, sample_city_id)

    print(out)

testit('find_overlapping_lidar_scans')