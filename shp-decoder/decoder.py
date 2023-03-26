# https://epsg.io/transform#s_srs=6420&t_srs=4326&x=0.0000000&y=0.0000000
# from 6420 => 4326 projection
# x (w-e) 6054000 - 6051000 = -2979
# y (n-s) 2133000 - 2130000 = 2993
# sw corner:

import geopandas
from shapely.geometry import Polygon

d = {'col1': ['p1'], 'geometry': Polygon([[6051000,2130000], [6051000,2133000], [6054000,2133000], [6054000,2130000]])}
gdf = geopandas.GeoDataFrame(d, crs="EPSG:6420")
gdf2 = gdf.to_crs(4326)

p1 = Polygon([
       (-122.3583707, 37.9432179),
       (-122.3583707, 37.9422179),
       (-122.3573707, 37.9422179),
       (-122.3573707, 37.9432179)])

print(p1.intersects(gdf2.geometry[0]))
