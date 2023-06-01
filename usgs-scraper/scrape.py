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
url_base = 'https://rockyweb.usgs.gov/vdelivery/Datasets/Staged/Elevation/LPC/Projects'

def downloads_dir_get(project_id):
    dir_path = 'projects/%s/_downloads' % (project_id)
    if not os.path.isdir(dir_path):
       os.makedirs(dir_path)
    return dir_path

def project_db_get(project_id, subproject_id):
    path = 'projects/%s/%s/data.json' % (project_id, subproject_id)
    data = {}
    if not os.path.isfile(path):
      f = open(path, 'w')
      f.write('{}')
      f.close()
    else:
      f = open(path)
      data = json.load(f)
      f.close()
    return data

def project_db_save(project_id, subproject_id, data):
    path = 'projects/%s/%s/data.json' % (project_id, subproject_id)
    f = open(path, 'w')
    charsWritten = f.write(json.dumps(data))
    f.close()
    return charsWritten > 0

def projects_get(is_return_json=False):
    index_dir = 'projects/_index'
    if not os.path.isdir(index_dir+'/backup'):
        os.makedirs(index_dir+'/backup', 0o774, True) # makde {projects_dir}/_index/backup, as that will auto-create _index/
    index_filename = '%s/index.json' % index_dir

    projects = None
    if not os.path.isfile(index_filename):
        projects = {'dateChecked': None, 'dateModified': None, 'data':{}}
        index_file = open(index_filename, 'w')
        json.dump(projects, index_file)
        index_file.close()
    else:
        jsonFile = open(index_filename, 'r')
        projects = json.load(jsonFile)
        jsonFile.close()

    projects_list_add_meta_data(projects['data'])

    return projects if not is_return_json else json.dumps(projects)




def projects_list_add_meta_data(projects, parent_dir=''):
    if not projects:
        return projects

    project_dirs_list = os.listdir('projects/%s' % parent_dir)
    for dir in project_dirs_list:
        if dir[0] == '.' or dir[0] == '_':
            continue
        projects[dir]['dateScraped'] = None
        project_meta_data_filepath = 'projects/%s%s/index.json' % (parent_dir+'/' if parent_dir else '', dir)
        if os.path.isfile(project_meta_data_filepath):
            project_meta_data_file = open(project_meta_data_filepath, 'r')
            project_meta_data = json.load(project_meta_data_file)
            projects[dir]['dateScraped'] = project_meta_data['dateScraped']
    return projects



def projects_list_compare(new_projects, old_projects):
    changes = {}
    for k in new_projects:
        if not k in old_projects:
            changes[k] = 'added on '+new_projects[k]['dateModified']
            new_projects[k]['isNew'] = True
        elif new_projects[k]['dateModified'] != old_projects[k]['dateModified']:
            new_projects[k]['oldDateModified'] = old_projects[k]['dateModified']
            changes[k] = 'was updated on %s' % new_projects[k]['dateModified']
    for k in old_projects:
        if not k in new_projects:
            changes[k] = 'removed'
            new_projects[k] = old_projects[k]
            new_projects[k]['isRemovedFromServer'] = True

    if len(changes.keys()) == 0:
        return None
    else:
        return changes

def projects_scrape(is_return_json=False):
    html_filepath = 'projects/_index/index.html'
    json_filepath = 'projects/_index/index.json'
    backup_dir = 'projects/_index/backup'
#     cmd = "wget -S --quiet -t 1 -O %s %s " % (html_filepath, url_base)
#     wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
#     wget_process_out = str(wget_process.communicate()[0], 'utf-8')
#     if wget_process_out != None and wget_process_out != '':
#         status = 'success'
#     else:
#         status = 'failed'
#         # TODO: log miss

    file = open(html_filepath)
    file.seek(0)

    regex = re.compile('<img[^>]+alt="\[DIR\]">\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)
    # <img src="/icons/folder.gif" alt="[DIR]"> <a href="WI_Statewide_2021_B21/">WI_Statewide_2021_B21/</a>  2023-02-10 11:13 -

    projects_list_scraped = {}
    for line in file:
      match = regex.search(line)
      # project folders always contain an underscore or hyphen
      if match != None and ('_' in match.group(1) or '-' in match.group(1)):
        projects_list_scraped[match.group(1).replace('/', '')] = {'dateModified': match.group(2), 'dateScraped': None}

    file.close()

    projects = projects_get(False)
    projects['dataChanges'] = None

    changes = None
    if projects:
        changes = projects_list_compare(projects_list_scraped, projects['data'])
        if not changes:
            # add extra data for each project (from local dir meta)
            projects_list_add_meta_data(projects['data'])

            projects['dateChecked'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return projects if not is_return_json else json.dumps(projects)
        else:
            # make a backup
            filepath_json_backup = '%s/%s__%d.json' % (
                    backup_dir,
                    datetime.now().strftime('%y_%m_%d_%H_%M_%S'),
                    random.randint(1000,10000-1))
            backup_cmd = 'cp %s %s' % (json_filepath,  filepath_json_backup)
            backup_process = subprocess.Popen(backup_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            backup_process_out = str(backup_process.communicate()[0], 'utf-8')


    json_file = open(json_filepath, 'w')
    projects = {
        "dateModified": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "dateChecked": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "data": projects_list_scraped,
        "dataChanges": changes
    }

    json_file.write(json.dumps(projects))
    json_file.close()

    # add extra data for each project (from local dir meta)
    # BUT DO NOT SAVE IT to global projects json
    projects_list_add_meta_data(projects['data'])

    return projects if not is_return_json else json.dumps(projects)

def subprojects_get(project_id, is_return_json=False):
    index_dir = 'projects/%s'
    if not os.path.isdir(index_dir+'/backup'):
        os.makedirs(index_dir+'/backup', 0o774, True) # makde {projects_dir}/_index/backup, as that will auto-create _index/
    index_filename = '%s/index.json' % index_dir

    projects = None
    if not os.path.isfile(index_filename):
        projects = {'dateChecked': None, 'dateModified': None, 'data':{}}
        index_file = open(index_filename, 'w')
        json.dump(projects, index_file)
        index_file.close()
    else:
        json_file = open(index_filename, 'r')
        projects = json.load(json_file)
        json_file.close()

    projects_list_add_meta_data(projects['data'])

    return projects if not is_return_json else json.dumps(projects)




def project_metadata_count(project_id):
    downloads_dir = downloads_dir_get(project_id)
    # grab all JSONs in the "download" folder for individual data file info
    cmd = "ls %s/*.json | wc -l | cat" % (downloads_dir)
    scrape_concat_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    scrape_concat_process_out = str(scrape_concat_process.communicate()[0], 'utf-8')
    return scrape_concat_process_out


def project_get(project_id, is_return_json=False):
    downloads_dir = downloads_dir_get(project_id)
    index_dir = 'projects/%s' % project_id
    if not os.path.isdir(index_dir):
        os.makedirs(index_dir)
    index_filename = 'projects/%s/index.json' % (project_id)
    project = {"dateScraped": None, "subprojects": None, "hasMetadata": False, "isMetadataZipped": False, "hasLaz": False, "data": None}

    if os.path.isfile(index_filename):
        index_file = open(index_filename, 'r')
        project = json.load(index_file)
        index_file.close()
    else:
        index_file = open(index_filename, 'w')
        json.dump(project, index_file)
        index_file.close()

    if not project['dateScraped']:
        return json.dumps(project) if is_return_json else project

    if project['subprojects']:
        for subproject_id in project['subprojects']:
            subproject_filename = 'projects/%s/%s/index.json' % (project_id, subproject_id)
            if os.path.isfile(subproject_filename):
                subproject_file = open(subproject_filename, 'r')
                subproject = json.load(subproject_file)
                project['subprojects'][subproject_id]['dateScraped'] = subproject['dateScraped']

    # grab all JSONs in the "download" folder for individual data file info
    cmd = "cat %s/*.json 2>/dev/null" % (downloads_dir)
    scrape_concat_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    scrape_concat_process_out = str(scrape_concat_process.communicate()[0], 'utf-8')
    scraped_files_text = '[]'

    # place all files output in an array/list
    if scrape_concat_process_out != None and scrape_concat_process_out != '':
        scraped_files_text = '[%s]' % (scrape_concat_process_out.replace("}{", "},{"))

    project_data_list = json.loads(scraped_files_text)
    project['data'] = {}
    for item in project_data_list:
        project['data'][item['name']] = item

    return json.dumps(project) if is_return_json else project



def project_scrape(project_id, is_return_json=False):
    project = project_get(project_id)
    project['dateScraped'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    project_data = project.pop('data') # do not save the data (that lives in separate files)

    downloads_dir = downloads_dir_get(project_id)
    index_filename = 'projects/%s/index.json' % (project_id)
    index_html_filename = downloads_dir + '/index.html'
    index_url = '%s/%s/' % (url_base, project_id)

    wget_status = wget_fetch(index_url, index_html_filename, 9)
    if wget_status != True:
        project['error'] = 'failed to fetch index of %s (%s): %s' % (project_id, index_url, wget_status)
        index_file = open(index_filename, 'w')
        json.dump(project, index_file)
        index_file.close()
        return json.dumps(project) if is_return_json else project

    regex_dir = re.compile('<img[^>]+alt="\[DIR\]">\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)

    index_html_file = open(index_html_filename, 'r')
    index_html_file.seek(0)

    dirs = {}
    for line in index_html_file:
      match_dir = regex_dir.search(line)
      if match_dir != None:
        dir = match_dir.group(1).replace('/', '')
        dirs[dir] = {'dateModified': match_dir.group(2)}

    if not 'metadata' in dirs:
        project['subprojects'] = dirs
    else:
        project['hasMetadata'] = True

    if 'laz' in dirs:
        project['hasLaz'] = True

    index_file = open(index_filename, 'w')
    json.dump(project, index_file)
    index_file.close()

    if project['hasMetadata']:
        project_data = project_metadata_index_scrape(project_id, project_data)

    project['data'] = project_data  # still return the data which lives in separate files for each project file/tile
    return json.dumps(project) if is_return_json else project

def project_metadata_index_scrape(project_id, saved_project_data):
    downloads_dir = downloads_dir_get(project_id)

    index_filename = 'projects/%s/index.json' % (project_id)

    index_file = open(index_filename, 'r')
    project = json.load(index_file)
    index_file.close()

    index_html_filename = downloads_dir + '/meta_index.html'
    index_url = '%s/%s/metadata' % (url_base, project_id)

    wget_status = wget_fetch(index_url, index_html_filename, 9)
    if wget_status != True:
        project['error'] = 'failed to fetch meta-data index of %s (%s)' % (project_id, index_url)
        index_file = open(index_filename, 'w')
        json.dump(project, index_file)
        index_file.close()
        return json.dumps(project) if is_return_json else project

    regex_file = re.compile('<img[^>]+alt="\[TXT\]">\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)
    regex_zip = re.compile('<img[^>]+compressed.gif[^>]+>\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)

    index_html_file = open(index_html_filename, 'r')
    index_html_file.seek(0)

    project_data = {}
    for line in index_html_file:
      match_file = regex_file.search(line)
      match_zip = regex_zip.search(line)
      if match_file != None:
        meta_name = match_file.group(1).replace('.xml', '')
        # project has META DATA (not a zip file)
        project_data[meta_name] = {'dateModified': match_file.group(2)}
      elif match_zip != None:
        project['isMetadataZipped'] = True
        project['zippedData'] = {'file': match_zip.group(1), 'dateModified': match_zip.group(2)}


    # project has (META) DATA (not a zip file)
    if project_data.keys():
        for k in saved_project_data:
            if not k in projects_data:
                saved_project_data[k]['isRemoved'] = True
                project_data[k] = saved_project_data[k]
        for k in project_data:
            if not k in saved_project_data:
                saved_project_data[k] = {'name': k, 'dateScraped': None }
            saved_project_data[k]['dateModified'] = project_data[k]['dateModified']
            project_data[k] = saved_project_data[k]

            file = open('%s/%s.json' % (downloads_dir, k), 'w')
            json.dump(project_data[k], file)

    index_html_file = open(index_filename, 'w')
    json.dump(project, index_html_file)
    index_file.close()

    return project_data

def metadata_files_fetch(project_id, limit=4):
    project = project_get(project_id)
    i = 0
    for meta_filename in project['data']:
        meta_meta = project['data'][meta_filename]
        if not meta_meta['dateScraped'] or meta_meta['scrapedStatus'] == 'failed' or meta_meta['dateScraped'] < meta_meta['dateModified']:
            status = metadata_file_fetch(project_id, meta_filename)
            if status == 'success':
                (bounds_polygon_coordinates, dates, projection, errors) = metadata_extract_data(project_id, meta_filename)
                meta_meta['bounds'] = bounds_polygon_coordinates
                meta_meta['dates'] = dates
                meta_meta['projection'] = projection
                meta_meta['errors'] = errors

            print('scraped %s %s' % (meta_filename, status))
            meta_meta['scrapedStatus'] = status
            meta_meta['dateScraped'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            meta_filepath = '%s/%s.json' % (downloads_dir_get(project_id), meta_filename)
            meta_file = open(meta_filepath, 'w')
            json.dump(meta_meta, meta_file)
            meta_file.close()
        else:
            print('already scraped %s' % (meta_filename))

        i = i + 1

        # Testing
        if limit > 0 and i > limit:
            break

    return True

def metadata_file_fetch(project_id, filename):
    status = 'in progress'
    meta_url = '%s/%s/metadata/%s.xml' % (url_base, project_id, filename)
    dir_path = downloads_dir_get(project_id)
    download_filepath = '%s/%s.xml' % (dir_path, filename)

    wget_status = wget_fetch(meta_url, download_filepath, 9)
    return 'success' if wget_status == True else wget_status

def metadata_extract_data(project_id, filename):
    dir_path = downloads_dir_get(project_id)
    file_obj = open(dir_path + '/' + filename + ('.xml' if not '.xml' in filename else ''))
    file_obj.seek(0)

    date_seen = False
    date_extracted = False
    bounds_seen = False
    bounds_extracted = False

    dates = []
    bounds = {}
    projection = ''
    errors = {}

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
        errors['bounds'] = 'less than 4 vorteces of bbox'
        bounds_polygon_coordinates = None
    else:
        bounds_polygon_coordinates = [
          [bounds['w'], bounds['n']],
          [bounds['e'], bounds['n']],
          [bounds['e'], bounds['s']],
          [bounds['w'], bounds['s']]]

    return (bounds_polygon_coordinates, dates, projection, errors)


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

def find_overlapping_lidar_scans(project_id, subproject_id, city_id):
    city_multi_polygon = city_polygon_get(city_id)

    dir_path = downloads_dir_get(project_id)
    file_list = os.listdir(dir_path)

    file_bounds_and_date = {}
    for f in file_list:
      if f.find('.xml') < 0:
        continue
      bounds_and_date = metadata_extract_data(project_id, subproject_id, f)
      if bounds_and_date != None:
        if polygon_multipolygon_overlap_check(bounds_and_date[0], city_multi_polygon):
          file_bounds_and_date[f] = bounds_and_date

    return file_bounds_and_date

def download_meta_shape_files_from_zip(index_filename, project_id, subproject_id, limit=4):
    # download ZIP
    # extract ZIP
    # extract geo info from SHP file => geojson ?!
    #  USE geopandas to read SHP file (as long as all other files are in same dir)
    return None

projections_aliases = {
    'NAD83(CSRS98)' : 'EPSG:4140',
    'NAD83(HARN)' : 'EPSG:4152',
    'WGS 84' : 'EPSG:4326',
    'NAD83(CSRS)' : 'EPSG:4617',
    'NAVD88 height' : 'EPSG:5703',
    'NAD83(2011)' : 'EPSG:6318',
    'NAD83(CSRS)v2' : 'EPSG:8237',
    'NAD83(CSRS)v3' : 'EPSG:8240',
    'NAD83(CSRS)v4' : 'EPSG:8246',
    'NAD83(CSRS)v6' : 'EPSG:8252',
    'NAD83(CSRS)v7' : 'EPSG:8255'
}

def projection_convert(coordinates, projection, geometry_type):
    import geopandas

    # CAlifornia projection 6420 (ID is the SW corner of the tile "w123123n123123")
    # "EPSG:6420"
    # [[6051000,2130000], [6051000,2133000], [6054000,2133000], [6054000,2130000]]
    # https://epsg.io/transform#s_srs=6420&t_srs=4326&x=0.0000000&y=0.0000000
     # x (w->e) 6054000 ---decreases---> 6051000 = 3000 (feet wide)
    # y (n->s) 2133000 ---decreases---> 2130000 = 3000 (feet tall)

    # data for GeoDataFrame with local-projection coordinates
    if geometry_type == 'polygon':
      geometry = Polygon(coordinates)
    elif geometry_type == 'point':
      geometry = Point(coordinates)

    data = {'col1': ['p1'], 'geometry': geometry}

    # convert alias/alternate projection ID to standard EPSG ID
    projection_EPSG = projection
    if projection in projections_aliases:
        projection_EPSG = projections_aliases[projection]

    print (projection_EPSG)
    # specify projection of coordinates
    geo_data_frame = geopandas.GeoDataFrame(data, crs=projection_EPSG)
    # convert to standard lng/lat
    geo_data_frame_EPSG4326 = geo_data_frame.to_crs(4326)

    # returns a Shapely Polygon/Point object
    return geo_data_frame_EPSG4326.geometry[0]


def laz_file_fetch(project_id, subproject_id, filename):
    status = 'in progress'
    dir_path = downloads_dir_get(project_id)
    url = '%s/%s/%s/LAZ/%s' % (url_base, project_id, subproject_id, filename)
    download_filepath = '%s/%s' % (dir_path, filename)

    wget_status = wget_fetch(url, download_filepath, 9)
    return 'success' if wget_status == True else wget_status

def laz_extract_data(project_id, subproject_id, filename, point_limit=0):
    # Buffered read to extract all dates of individual points
    #  (buffered so that we do not need HUGE RAM and costly VMs)
    import numpy as np
    import laspy

    dir_path = downloads_dir_get(project_id)
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


      i = point_limit
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
        if point_limit > 0 and i <= 0:
          break

    #now turn the unix timstamp to a local timestamp:
    data['date_range_local'] = [datetime.fromtimestamp(data['date_range'][0]), datetime.fromtimestamp(data['date_range'][1])]

    return data

def laz_meta_extract_data(project_id, subproject_id, filename):
    meta_filename = filename.replace('.laz', '.xml')
    laz_filename = filename.replace('.xml', '.laz')
    laz_data = laz_extract_data(project_id, subproject_id, laz_filename)
    meta_data = metadata_extract_data(project_id, subproject_id, meta_filename)

    converted = projection_convert(laz_data['bbox'][0], meta_data[2], 'point')
    print (laz_data)
    print(laz_data['bbox'][0], meta_data[2], converted)

def test_fetch(url, download_filepath):
    return wget_fetch(url, download_filepath, 2)

def wget_fetch(url, download_filepath, retries=9):
    i = retries
    wget_process_out = None
    while i > 0:
      cmd = "wget -S --quiet -t 1 -O %s %s " % (download_filepath, url)
      wget_process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
      wget_process_out = str(wget_process.communicate()[0], 'utf-8')

      if wget_process_out != None and wget_process_out != '':
        break
      i = i - 1

    return check_wget_response_and_download(wget_process_out, download_filepath)

def check_wget_response_and_download(response, download_filepath):
    if response == None or response == '':
        return 'no response'

    if not os.path.isfile(download_filepath):
        return ''

    file = open(download_filepath, 'r')
    file_contents = file.read()
    if len(file_contents) == 0:
        os.remove(download_filepath)
        return 'not downloaded'

    response_lines = response.split("\n")
    if not ' 200 ' in response_lines[0]:
        os.remove(download_filepath)
        return response_lines[0]

    return True

def cleanup_download(filepath):
    if os.path.isfile(filepath):
        os.remove(filepath)

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

def run(cmd, args):
    out = '''select a Command:
        projects_get
        downloads_dir_get
        downloads_dir_list
        project_get
        metadata_files_fetch
        metadata_file_fetch
        metadata_extract_data
        city_polygon_get
        polygon_multipolygon_overlap_check
        find_overlapping_lidar_scans
        laz_file_fetch
        laz_extract_data
        laz_and_meta_extract_data
        --- test: ----
        test_fetch
        '''
    if cmd == 'downloads_dir_get':
        out = downloads_dir_get(args.project_id)
    elif cmd == 'project_get':
        out = project_get(args.project_id+('/'+args.subproject_id if args.subproject_id else ''), args.options=='json_only')
    elif cmd == 'project_scrape':
        out = project_scrape(args.project_id+('/'+args.subproject_id if args.subproject_id else ''), args.options=='json_only')
    elif cmd == 'metadata_files_fetch':
        out = metadata_files_fetch(args.project_id+('/'+args.subproject_id if args.subproject_id else ''), -1)
    elif cmd == 'project_metadata_count':
        out = project_metadata_count(args.project_id+('/'+args.subproject_id if args.subproject_id else ''))
    elif cmd == 'metadata_file_fetch':
        out = metadata_file_fetch(args.project_id, args.subproject_id, args.file)
    elif cmd == 'downloads_dir_list':
        out = os.listdir(downloads_dir_get(args.project_id))
    elif cmd == 'metadata_extract_data':
        out = metadata_extract_data(args.project_id, args.subproject_id, args.file)
    elif cmd == 'city_polygon_get':
        out = city_polygon_get(args.city_id)
    elif cmd == 'polygon_multipolygon_overlap_check':
        out = polygon_multipolygon_overlap_check(
          metadata_extract_data(args.project_id, args.subproject_id, args.file)[0],
          city_polygon_get(args.city_id))
    elif cmd == 'find_overlapping_lidar_scans':
        out = find_overlapping_lidar_scans(
                args.project_id, args.subproject_id, args.city_id)
    elif cmd == 'laz_file_fetch':
        out = laz_file_fetch(args.project_id, args.subproject_id, args.file)
    elif cmd == 'laz_extract_data':
        out = laz_extract_data(args.project_id, args.subproject_id, args.file)
    elif cmd == 'laz_and_meta_extract_data':
        out = laz_meta_extract_data(args.project_id, args.subproject_id, args.file)
    elif cmd == 'projects_get':
        out = projects_get(args.options == 'json_only')
    elif cmd == 'projects_scrape':
        out = projects_scrape(args.options == 'json_only')
    elif cmd == 'test_fetch':
        out = test_fetch(args.test_url, args.test_download_file)

    print(out)

import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--cmd', dest='cmd', type=str, help='Specify command')
parser.add_argument('--project_id', dest='project_id', type=str, help='Specify project ID')
parser.add_argument('--subproject_id', dest='subproject_id', type=str, help='Specify sub-project ID')
parser.add_argument('--file', dest='file', type=str, help='Specify file')
parser.add_argument('--options', dest='options', type=str, help='Specify options')
parser.add_argument('--test-url', dest='test_url', type=str, help='Specify TEST URL')
parser.add_argument('--test-download-file', dest='test_download_file', type=str, help='Specify TEST download file')
args = parser.parse_args()

sample_project_id = 'CA_NoCAL_3DEP_Supp_Funding_2018_D18'
sample_subproject_id = 'CA_NoCAL_Wildfires_B5b_2018'
sample_meta_index = 'meta_index_23_03_01_12_29_46__6407.html'
sample_meta = 'USGS_LPC_CA_NoCAL_3DEP_Supp_Funding_2018_D18_w2215n1973.xml'
sample_laz = 'USGS_LPC_CA_NoCAL_3DEP_Supp_Funding_2018_D18_w2215n1973.laz'
sample_city_id = 'richmond-ca'
sample_lidar_polygon = [
   (-122.3583707, 37.9432179),
   (-122.3583707, 37.9422179),
   (-122.3573707, 37.9422179),
   (-122.3573707, 37.9432179)]

if (__name__ == '__main__'):
    run(args.cmd, args)