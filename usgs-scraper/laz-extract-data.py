import os
import sys
from datetime import datetime
import numpy as np
import laspy
import json

def laz_extract_data(file_path, point_limit=0):
    # Buffered read to extract all dates of individual points
    #  (buffered so that we do not need HUGE RAM and costly VMs)

    data = {'bbox': [], 'bbox_polygon': [], 'date_range': [None, None]}
    with laspy.open(file_path) as f:

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
      for point in f.chunk_iterator(500):
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



    return '\n'.join([
        'bbox:'+json.dumps(data['bbox']),
        'bbox_poly:'+json.dumps(data['bbox_polygon']),
        'date_start:'+datetime.fromtimestamp(data['date_range'][0]).strftime('%Y%m%d%H%M%S'), #now turn the unix timstamp to a local timestamp:
        'date_end:'+datetime.fromtimestamp(data['date_range'][1]).strftime('%Y%m%d%H%M%S')
    ])

if (__name__ == '__main__'):
    print(laz_extract_data(sys.argv[1]))