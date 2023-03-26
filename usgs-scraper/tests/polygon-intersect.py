
def use_polygon_directly(multipolygon):
    from shapely.geometry import Polygon
    p1 = Polygon([
            (-122.3583707, 37.9432179),
            (-122.3583707, 37.9422179),
            (-122.3573707, 37.9422179),
            (-122.3573707, 37.9432179)
        ])

    is_intersects = False
    for polygon_i in multipolygon:
        p2 = Polygon(polygon_i[0])
        is_intersects = is_intersects or p1.intersects(p2)

    print (is_intersects)

def use_geopandas(multipolygon):
    from shapely.geometry import Polygon, LineString, Point
    from geopandas import GeoSeries

    s = GeoSeries([
        Polygon([
            (-121.3583707, 37.9432179),
            (-121.3583707, 37.9422179),
            (-121.3573707, 37.9422179),
            (-121.3573707, 37.9432179)
        ])
    ])

    # print(multipolygon[0])
    i = s.intersection( Polygon(multipolygon[0][0]) )
    print(i == None)

import json
city_bounds_file_obj = open('../cities/richmond-ca.json')
city_bounds = json.loads(city_bounds_file_obj.read())
city_bounds_multipolygon = city_bounds.get('geometries')[0].get('coordinates')
use_polygon_directly(city_bounds_multipolygon)
use_geopandas(city_bounds_multipolygon)