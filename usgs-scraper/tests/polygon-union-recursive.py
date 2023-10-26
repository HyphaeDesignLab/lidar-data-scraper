from shapely.geometry import Polygon, MultiPolygon, mapping
import time
import sys
import json

# https://shapely.readthedocs.io/en/stable/reference/shapely.union.html

# expects array of SIMPLE POLYGON rings (without wrapper GEOJSON hash and without HOLES)
def polygon_intersect_and_unite(polygons):
    total = len(polygons)
    unions = []
    indeces = [ i for i in range(0, total-1) ]
    last_indeces_len = len(indeces)
    new_indeces_len = len(indeces)
    current_union = None

    while new_indeces_len > 1 :
        to_remove = []
        start_pos = 0
        if current_union is None:
            to_remove.append(0)
            current_union = Polygon(polygons[indeces[0]])
            start_pos = 1

        for j in range(start_pos, len(indeces)-1):
            p = Polygon(polygon[indeces[j]])
            if union.intersects(p):
                union = union.union(p)
                to_remove.append(j)

        for k in to_remove.sort(reverse=True):
            del to_remove[k]

        new_indeces_len = len(indeces)
        unions.append(union)



# expects array of SIMPLE POLYGON rings (without wrapper GEOJSON hash and without HOLES)
def polygon_unions(polygons):
    union_batches = polygon_unions__helper(polygons, 100) # first batch size is 100
    while len(union_batches) > 1:
        union_batches = polygon_unions__helper(union_batches, 10) # next batch size is 10
    if len(union_batches) > 1:
        print ('hmmmmm the final union has multiple batches STILL')
    return union_batches[0]

# expects array of SIMPLE POLYGON rings (without wrapper GEOJSON hash and without HOLES)
def polygon_unions__helper(polygons, batch_size):
    # print('batches of %s (length of array: %s)' % (batch_size, len(polygons)))
    union_batches = []
    union = None
    union_arr = []

    i = 0
    last_i = len(polygons) - 1
    start_time = time.time()
    for polygon in polygons:
        if i % batch_size == 0 and union or i == last_i:
            union_batches.append(union)
            union = None
            end_time = time.time()
            # print(i, end_time - start_time )
            start_time = end_time
        i = i + 1

        polygon_safe = Polygon(polygon) if (type(polygon) == list or type(polygon) == tuple) else polygon

        if union is None:
            union = polygon_safe
        else:
            union = union.union(polygon_safe)

    # print(i, end_time - start_time )
    # print('result array length  %s ' % (len(union_batches)))
    return union_batches

# returns array of SIMPLE POLYGON ring (without wrapper GEOJSON array and without HOLES)
def get_data_from_individual_xml_txt_files(input_dir):
    import glob
    polygons = []

    for file_name in glob.glob(f'{input_dir}/*.xml.txt'):
        bounds = {}
        file = open(file_name)
        for line in file:
            line=line.replace('\n', '')
            line_pieces=line.split(':')
            if line_pieces[0] == 'date_start':
                date_start=line_pieces[1]
            elif line_pieces[0] == 'date_end':
                date_end=line_pieces[1]
            elif line_pieces[0] in ['south', 'north', 'east', 'west']:
                try:
                    bounds[line_pieces[0]]=float(line_pieces[1])
                except Exception as e:
                    print ('%s has error: %s' % (file_name, e))

            if 'east' not in bounds or 'west' not in bounds or 'south' not in bounds or 'north' not in bounds:
                continue

            if bounds['west'] > 0 and bounds['south'] < 0:
                tmp = bounds['south']
                bounds['south'] = bounds['west']
                bounds['west'] = tmp
            if bounds['east'] > 0 and bounds['north'] < 0:
                tmp = bounds['north']
                bounds['north'] = bounds['east']
                bounds['east'] = tmp
        file.close()

        polygons.append([
          [bounds['west'], bounds['north']],
          [bounds['east'], bounds['north']],
          [bounds['east'], bounds['south']],
          [bounds['west'], bounds['south']],
          [bounds['west'], bounds['north']]
        ])

    print(f'{len(polygons)} polygons')
    return polygons

# assumes feature geometry is POLYGON and it IGNORE polygon HOLES
# returns array of SIMPLE POLYGON ring (without wrapper GEOJSON array and without HOLES)
def get_data_from_geojson_file(file_path):
    file = open(file_path)
    obj = json.load(file)
    file.close()
    polygons = []
    for feature in obj['features']:
        polygons.append(feature['geometry']['coordinates'][0])
    print(f'{len(tiles)} polygons')
    return polygons



def test_polygon_union(polygons):
    polygon1 = Polygon(
        [
            [-122.6, 37.6],
            [-122.6, 37.5],
            [-122.5, 37.5],
            [-122.5, 37.6],
            [-122.6, 37.6]
         ],
         holes=[]
    )
    polygon2 = Polygon(
        [
            [-122.44, 37.95],
            [-122.44, 37.85],
            [-122.38, 37.85],
            [-122.38, 37.95],
            [-122.44, 37.95]
         ],
         holes=[]
    )

    union = polygon1.union(polygon2)
    union_geojson_obj = { "type": "FeatureCollection", "features": [
        {'properties': {'type':'poly'}, 'geometry': mapping(polygon1)},
        {'properties': {'type':'poly'}, 'geometry': mapping(polygon2)},
        {'properties': {'type':'union'}, 'geometry': mapping(union)}
    ]}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('need an input')
        sys.exit()

    # files = get_data_from_geojson_file(sys.argv[1])
    start_time = time.time()
    polygons = get_data_from_individual_xml_txt_files(sys.argv[1])
    union = polygon_unions(polygons)

    union = polygon_unions([ polygon[0] for polygon in mapping(union)['coordinates'] ])
    f = open('test.json', 'w')
    f.write(json.dumps( {'type': 'FeatureCollection', 'features': [ {'properties': {}, 'geometry': mapping(union)} ]} ))
    f.close()
    end_time = time.time()

    print(f'{end_time - start_time} seconds')
