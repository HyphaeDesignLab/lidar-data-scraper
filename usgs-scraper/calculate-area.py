import sys
from pyproj import Geod
from shapely import wkt

file_path = sys.argv[1]
file = open(file_path, 'r')
east=None
west=None
south=None
north=None

for line in file:
    line = line.replace('\n', '')
    if 'south:' in line:
        south = line.replace('south:', '')
    if 'north:' in line:
        north = line.replace('north:', '')
    if 'east:' in line:
        east = line.replace('east:', '')
    if 'west:' in line:
        west = line.replace('west:', '')


# specify a named ellipsoid
geod = Geod(ellps="WGS84")
poly_str = f'''\
           POLYGON ((
           {west} {north},
           {east} {north},
           {east} {south},
           {west} {south},
           {west} {north}
           ))'''
poly = wkt.loads(poly_str)

area = abs(geod.geometry_area_perimeter(poly)[0])

print('{:.3f}'.format(area/pow(10,6))) # square km