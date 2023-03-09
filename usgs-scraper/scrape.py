import subprocess
import re
import os
import sys
import random
import json
from shapely.geometry import Polygon, Point
from datetime import datetime

# configure URL base to come from a CONFIG file
# TODO: run a check on base URL to confirm that it is still viable
usgs_url_base = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects'

downloads_dir = '_downloads'

def downloads_dir_get(project_name, project_dataset):
    dir_path = '%s/%s__%s' % (downloads_dir, project_name, project_dataset)
    if not os.path.isdir(dir_path):
       os.makedirs(dir_path)
    return dir_path

def metadata_index_get(project_name, project_dataset, index_filename_custom=None):
    index_filename = downloads_dir_get(project_name, project_dataset) + '/'
    if index_filename_custom != None:
      index_filename += index_filename_custom
    else:
      index_filename += 'meta_index_%s__%d.html' % (
        datetime.now().strftime('%y_%m_%d_%H_%M_%S'),
        random.randint(1000,10000-1))

    index_url = '%s/%s/%s/metadata/' % (usgs_url_base, project_name, project_dataset)

    i = 9
    while i > 0:
      cmd = "wget -S --quiet -t 1 -O %s %s " % (index_filename, index_url)
      wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
      wget_process_out = str(wget_process.communicate()[0], 'utf-8')
      if wget_process_out != None and wget_process_out != '':
        status = 'success'
        break
      else:
        status = 'failed'
        # TODO: log miss
      i = i - 1

    if status == 'failed':
      print('did not fetch xml index')
      return None

    return index_filename

def metadata_files_fetch(index_filename, project_name, project_dataset, limit=4):
    xml_regex = re.compile('(?<=\>)[\w\.\-]+\.xml', re.IGNORECASE)
    ## TEST
    ##match = xml_regex.search('asdasd>a_a.xml asdas')
    ##print(match)

    dir_path = downloads_dir_get(project_name, project_dataset)
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
      status = metadata_file_fetch(meta_filename, project_name, project_dataset)
      meta_filenames_status.append( '%s (%s)' % (status, meta_filename) )
      i = i + 1

      # Testing
      if limit > 0 and i > limit:
       break

    return meta_filenames

def metadata_file_fetch(filename, project_name, project_dataset):
    status = 'in progress'
    meta_url = '%s/%s/%s/metadata/%s' % (usgs_url_base, project_name, project_dataset, filename)
    dir_path = downloads_dir_get(project_name, project_dataset)
    download_filepath = '%s/%s' % (dir_path, filename)

    j = 9
    while j > 0:
      cmd = "wget -S --quiet -t 1 -O %s %s " % (download_filepath, meta_url)
      wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
      wget_process_out = str(wget_process.communicate()[0], 'utf-8')

      if wget_process_out != None and wget_process_out != '':
        status = 'success'
        break
      else:
        status = 'failed'
        # TODO: log miss
      j = j - 1

    return status

def metadata_extract_data(project_name, project_dataset, filename):
    dir_path = downloads_dir_get(project_name, project_dataset)
    file_obj = open(dir_path + '/' + filename)
    file_obj.seek(0)

    date_seen = False
    date_extracted = False
    bounds_seen = False
    bounds_extracted = False

    dates = []
    bounds = {}
    projection = ''

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

      if line.find('<mapprojn>') >= 0:
        projection = line.replace('<mapprojn>', '').replace('</mapprojn>', '').strip()

    projection_cleanup_regex = re.compile('\s*/.+$', re.IGNORECASE)
    if projection != '':
      projection = projection_cleanup_regex.sub('', projection)
      projection = projection.strip()

    if len(bounds.keys()) < 4:
      # TODO: log miss
      return None

    bounds_polygon_coordinates = [
      [bounds['w'], bounds['n']],
      [bounds['e'], bounds['n']],
      [bounds['e'], bounds['s']],
      [bounds['w'], bounds['s']]]

    return (bounds_polygon_coordinates, dates, projection)


def polygon_multipolygon_overlap_check(lidar_polygon, city_multi_polygon):
    p1 = Polygon(lidar_polygon)
    is_intersects = False
    for polygon_i in city_multi_polygon:
        p2 = Polygon(polygon_i[0]) # take the first "shell" polygon (and not the subsequent "holes")
        is_intersects = is_intersects or p1.intersects(p2)

    return is_intersects


def city_polygon_get(city_id):
    file_obj = open('../cities/%s.json' % city_id)
    bounds = json.loads(file_obj.read())
    multipolygon = bounds.get('geometries')[0].get('coordinates')
    return multipolygon

def find_overlapping_lidar_scans(project_name, project_dataset, city_id):
    city_multi_polygon = city_polygon_get(city_id)

    dir_path = downloads_dir_get(project_name, project_dataset)
    file_list = os.listdir(dir_path)

    file_bounds_and_date = {}
    for f in file_list:
      if f.find('.xml') < 0:
        continue
      bounds_and_date = metadata_extract_data(project_name, project_dataset, f)
      if bounds_and_date != None:
        if polygon_multipolygon_overlap_check(bounds_and_date[0], city_multi_polygon):
          file_bounds_and_date[f] = bounds_and_date

    return file_bounds_and_date

def download_meta_shape_files_from_zip(index_filename, project_name, project_dataset, limit=4):
    # download ZIP
    # extract ZIP
    # extract geo info from SHP file => geojson ?!
    #  USE geopandas to read SHP file (as long as all other files are in same dir)
    return None

def polygon_projection_convert():

    # CAlifornia projection 6420 (ID is the SW corner of the tile "w123123n123123")
    # https://epsg.io/transform#s_srs=6420&t_srs=4326&x=0.0000000&y=0.0000000
     # x (w->e) 6054000 ---decreases---> 6051000 = 3000 (feet wide)
    # y (n->s) 2133000 ---decreases---> 2130000 = 3000 (feet tall)

    # data for GeoDataFrame with local-projection coordinates
    d = {'col1': ['p1'], 'geometry': Polygon([[6051000,2130000], [6051000,2133000], [6054000,2133000], [6054000,2130000]])}

    # specify projection of coordinates
    gdf = geopandas.GeoDataFrame(d, crs="EPSG:6420")
    # convert to standard lng/lat
    gdf2 = gdf.to_crs(4326)

    # test intersection with another polygon
    p1 = Polygon([
           (-122.3583707, 37.9432179),
           (-122.3583707, 37.9422179),
           (-122.3573707, 37.9422179),
           (-122.3573707, 37.9432179)])

    print(p1.intersects(gdf2.geometry[0]))


def laz_file_fetch(project_name, project_dataset, filename):
    status = 'in progress'
    dir_path = downloads_dir_get(project_name, project_dataset)
    url = '%s/%s/%s/LAZ/%s' % (usgs_url_base, project_name, project_dataset, filename)
    download_filepath = '%s/%s' % (dir_path, filename)

    i = 9
    while i > 0:
      cmd = "wget -S --quiet -t 1 -O %s %s " % (download_filepath, url)
      wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
      wget_process_out = str(wget_process.communicate()[0], 'utf-8')

      if wget_process_out != None and wget_process_out != '':
        status = 'success'
        break
      else:
        status = 'failed'
        # TODO: log miss
      i = i - 1

    return status

def laz_extract_data(project_name, project_dataset, filename):
    # Buffered read to extract all dates of individual points
    #  (buffered so that we do not need HUGE RAM and costly VMs)
    import numpy as np
    import laspy

    dir_path = downloads_dir_get(project_name, project_dataset)
    file = '%s/%s' % (dir_path, filename)

    data = {'bbox': [], 'bbox_polygon': [], 'date_range': [None, None]}
    with laspy.open(file) as f:

      # fetch bounding box from header (if meta data did not provide any info on bounding box)
      data['bbox'].append([f.header.min[0], f.header.max[0]]) # x0, y0 = lng0, lat0
      data['bbox'].append([f.header.min[1], f.header.max[1]]) # x1, y1 = lng1, lat1
      data['bbox_polygon'].append([f.header.min[0], f.header.max[1]]) # x0, y1 = lng0, lat1
      data['bbox_polygon'].append([f.header.min[0], f.header.min[1]])
      data['bbox_polygon'].append([f.header.max[0], f.header.min[1]])
      data['bbox_polygon'].append([f.header.max[0], f.header.max[1]])
      # f.header.min[2] # z0 (elevation0)
      # f.header.max[2] # z1 (elevation1)


      i = 10
      for point in f.chunk_iterator(100):
        gps_times = list(point.point_format.dimension_names)
        gps_times_index = gps_times.index('gps_time')
        #gps_time is often used in the laz 1.4 standard. However, the lidar operator may do something weird here so be careful!
        #actually it is always a bit weird: The gps_time is seconds since January 6th 1980 minus 1 billion. So to get a unix timestamp we do the following:
        unix_time = point.gps_time[0]+1000000000+315964782

        if data['date_range'][0] == None:
          data['date_range'][0] = unix_time
        if data['date_range'][1] == None:
          data['date_range'][1] = unix_time

        data['date_range'][0] = min(data['date_range'][0], unix_time)
        data['date_range'][1] = max(data['date_range'][1], unix_time)

        i = i - 1
        if i <= 0:
          break

    #now turn the unix timstamp to a local timestamp:
    data['date_range_local'] = [datetime.fromtimestamp(data['date_range'][0]), datetime.fromtimestamp(data['date_range'][1])]

    return data

# check if there is META Data
# if META DATA is a list of XML files, download them, find bouning box
# if META DATA is a ZIP file of SHP fileset, try to download and convert with geopandas to a bounding box
# if META DATA ZIP is corrupted or missing, use the wXXXX nYYYY local projection in filename and convert to a bounding box if we can figure out the projection
# if no metadata possible, count the number of LAZ files and if NOT too big, download them all and grab date/bounding box from there
# if DATA is older than 2014, mark it as old, check FILE NAME of project name/dataset for year


# RESULT
# TODO: an easy to way to monitor a scraping process (simple webpage that polls the scraped files/data)
#  - a list of USGS projects/datasets to scrape (with status next to each)
#  - button to kick off a scrape or re-scrape
#  - checks/status on
#      - scrape process is running normally, scrape process did not exist abnormally
#      - meta index was fetch (or failed to fetch): 2053 meta files total
#      - 2040 meta files fetched, 13 failed to fetch
#      - 2020 meta files contain proper bounding box/dates, 20 contain invalid bounding box/dates (manually investigate)
#      - 1240 meta files intersect with RICHMOND, CA,
#      - 1233 LAZ files fetch, 7 failed to fetch
#      - 1233 LAZ files dates parsed
#      - date ranges from LAZ: 1/2/2020-1/19/2020
#      - date ranges from Meta: 1/1/2020-1/20/2020

# TODO: tie to the satellite imagery

# TODO: compare the rngdates from XML meta file to point reading from LAZ file in first 2-3 sets to establish if meta data is enough
# city polygon
# array of lidar scan polygons with dates attached to each: rows of the format: <lidar polygon ID or polygon coordinates>,<start date>,<end date>,<LAZ/meta file URL>
# a global date range for entire city lidar points
#  ==> ideally we can put this on a Mapbox UI

def testit(test):
    sample_project_name = 'CA_NoCAL_3DEP_Supp_Funding_2018_D18'
    sample_project_dataset = 'CA_NoCAL_Wildfires_B5b_2018'
    sample_meta_index = 'meta_index_23_03_01_12_29_46__6407.html'
    sample_meta = 'USGS_LPC_CA_NoCAL_3DEP_Supp_Funding_2018_D18_w2215n1973.xml'
    sample_laz = 'USGS_LPC_CA_NoCAL_3DEP_Supp_Funding_2018_D18_w2215n1973.laz'
    sample_city_id = 'richmond-ca'
    sample_lidar_polygon = [
       (-122.3583707, 37.9432179),
       (-122.3583707, 37.9422179),
       (-122.3573707, 37.9422179),
       (-122.3573707, 37.9432179)]

    out = '''select a test
        downloads_dir_get
        downloads_dir_list
        metadata_index_get
        metadata_files_fetch
        metadata_file_fetch
        metadata_extract_data
        city_polygon_get
        polygon_multipolygon_overlap_check
        find_overlapping_lidar_scans
        laz_file_fetch
        laz_extract_data
        '''
    if test == 'downloads_dir_get':
        out = downloads_dir_get(sample_project_name, sample_project_dataset)
    elif test == 'metadata_index_get':
        metadata_index_get(sample_project_name, sample_project_dataset)
    elif test == 'metadata_files_fetch':
        out = metadata_files_fetch(sample_meta_index, sample_project_name, sample_project_dataset, -1)
    elif test == 'metadata_file_fetch':
        out = metadata_file_fetch(sample_meta, sample_project_name, sample_project_dataset)
    elif test == 'downloads_dir_list':
        out = os.listdir(downloads_dir_get(sample_project_name, sample_project_dataset))
    elif test == 'metadata_extract_data':
        out = metadata_extract_data(sample_project_name, sample_project_dataset, sample_meta)
    elif test == 'city_polygon_get':
        out = city_polygon_get(sample_city_id)
    elif test == 'polygon_multipolygon_overlap_check':
        out = polygon_multipolygon_overlap_check(
          metadata_extract_data(sample_project_name, sample_project_dataset, sample_meta)[0],
          city_polygon_get(sample_city_id))
    elif test == 'find_overlapping_lidar_scans':
        out = find_overlapping_lidar_scans(
                sample_project_name, sample_project_dataset, sample_city_id)
    elif test == 'laz_file_fetch':
        out = laz_file_fetch(sample_project_name, sample_project_dataset, sample_laz)
    elif test == 'laz_extract_data':
        out = laz_extract_data(sample_project_name, sample_project_dataset, sample_laz)

    print(out)

testit(  sys.argv[1] if len(sys.argv) > 1 else '')