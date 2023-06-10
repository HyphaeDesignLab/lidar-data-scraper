import sys
from pyproj import Geod
from shapely import wkt

def get_area(project):
    # specify a named ellipsoid
    geod = Geod(ellps="WGS84")
    poly_str = f'''\
               POLYGON ((
               {project['bounds']['west']} {project['bounds']['north']},
               {project['bounds']['east']} {project['bounds']['north']},
               {project['bounds']['east']} {project['bounds']['south']},
               {project['bounds']['west']} {project['bounds']['south']},
               {project['bounds']['west']} {project['bounds']['north']}
               ))'''
    poly = wkt.loads(poly_str)

    area = abs(geod.geometry_area_perimeter(poly)[0])
    return '{:.3f}'.format(area/pow(10,6)) # square km

file_path = sys.argv[1]
file = open(file_path, 'r')

file_path = sys.argv[1]
file = open (file_path, 'r')
project=None
for line in file:
    line = line.replace('\n', '')
    if '/' in line:
        project = {'bounds':{}, 'path': line }
    if 'south:' in line:
        project['bounds']['south'] = float(line.replace('south:', ''))
    if 'north:' in line:
        project['bounds']['north'] = float(line.replace('north:', ''))
    if 'east:' in line:
        project['bounds']['east'] = float(line.replace('east:', ''))
    if 'west:' in line:
        project['bounds']['west'] = float(line.replace('west:', ''))
    if len(project['bounds']) == 4:
        area = get_area(project)
        file_out = open(project['path'].replace('.xml.txt', '.area.txt'), 'w')
        file_out.write(area)
        file_out.close()

file.close()

