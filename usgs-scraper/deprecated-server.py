import http.server
import socketserver
import subprocess
import os
import sys
import json
import re

from datetime import datetime
from urllib.parse import parse_qs

def get_env():
    env = {}
    env_file = os.path.dirname(__file__) + '/.env'
    if not os.path.isfile(env_file):
        env_file = '.env'

    if os.path.isfile(env_file):
        file = open(env_file, 'r')
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
env = get_env()

class ScraperServer(http.server.SimpleHTTPRequestHandler):

    def do_POST(self):
        self.read_query('post')
        if not self.check_path():
            self.blank_response()
            return

        if not self.check_secret():
            self.blank_response()
            return

        if self.path.startswith('/map-tile-edit'):
            self.edit_map_tile()
        elif not os.path.isfile(os.getcwd() + self.path):
            self.blank_response(True)
            return
        else:
            self.blank_response(True)
            return

    def do_GET(self):
        self.read_query('get')
        if not self.check_path():
            self.blank_response()
            return

        if self.path.endswith('/'):
            self.path = self.path + 'index.html'

        if self.path.startswith('/test/map-tile-edit'):
            self.test_edit_map_tile_form()
        elif not os.path.isfile(os.getcwd() + self.path):
            self.blank_response()
            return
        else:
            super().do_GET()

    def check_path(self):
        if not self.path:
            return True
        bad_chars_re = re.compile('[^a-z0-9\-_/\.]', re.IGNORECASE)
        bad_chars_match = bad_chars_re.search(self.path)
        if bad_chars_match:
            return False
        return True


    def read_query(self, method='get'):
        if method == 'post':
            content_length = int(self.headers['Content-Length'])
            self.query = self.rfile.read(content_length).decode('utf-8')
        else:
            path_and_query = self.path.split('?') if self.path else [None, None]
            if len(path_and_query) < 2 or not path_and_query[1]:
                self.query = None
            else:
                self.query = path_and_query[1]
            self.path = path_and_query[0]

    def check_secret(self):
        if not self.query or not 'secret='+env['secret'] in self.query:
            self.bad_secret_code()
            return False
        return True

    def blank_response(self):
        self.send_response(404)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write('n/a'.encode('utf-8'))

    def bad_secret_code(self):
        self.send_response(401)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write('n/s'.encode('utf-8'))

    def edit_map_tile(self):
        parsed_query = parse_qs(self.query)
        json_string = parsed_query.get('json', [])[0]
        project = parsed_query.get('project', [])[0]
        file_name = f'projects/{project}/map_tiles.json'

        # backup, if it exists
        features = {}
        if os.path.isfile(file_name):
            f = open(file_name)
            now_string = datetime.now().strftime("%Y%m%d_%H%M%S")
            f_copy = open(f'projects/{project}/map_tiles_{now_string}.json', 'w')
            f_copy.write(f.read())
            f_copy.close()

            f.seek(0)
            features = json.load(f)
            f.close()

        # write new
        f = open(file_name, 'w')
        f.write(json_string)

        # write dates to *.xml.txt files as well (from which the map_tiles.json file is compiled)
        project_id_parts = project.split('/')
        for f in features['features']:
          tile_id = f['properties']['laz_tile']
          tile_id = tile_id.replace('{u}', 'USGS_LPC_')
          tile_id = tile_id.replace('{prj}', project_id_parts[0])
          if len(project_id_parts) > 1:
            tile_id = tile_id.replace('{sprj}', project_id_parts[1])
          xml_txt_file_path = f'projects/{project}/meta/{tile_id}.xml.txt'

          if os.path.isfile(xml_txt_file_path):
            xml_txt_file = open(xml_txt_file_path)
            xml_txt = ''
            for line in xml_txt_file:
                if 'date_start:' in line:
                    line = 'date_start:'+f['properties']['date_start']+'\n'
                if 'date_end:' in line:
                    line = 'date_end:'+f['properties']['date_end']+'\n'
                xml_txt = xml_txt + line
            xml_txt_file.close()
            xml_txt_file = open(xml_txt_file_path, 'w')
            xml_txt_file.write(xml_txt)
            xml_txt_file.close()

        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write('ok'.encode('utf-8'))

    def test_edit_map_tile_form(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        html = f'<form method="post" action="/map-tile-edit"><input name=secret value="{env["secret"]}"/><input name=project value="_test"/><input name=json value="[1,2,3]"/><input type="submit" /></form>'
        self.wfile.write(html.encode('utf-8'))

def start_server(custom_port=None):
    try:
        port = int(custom_port) if custom_port else int(env['port'])
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", port), ScraperServer) as httpd:
            if 'ssl' in env and env['ssl'] == 'true':
                import ssl
                httpd.socket = ssl.wrap_socket(httpd.socket, keyfile=env['ssl_cert_key_file'], certfile=env['ssl_cert_file'], server_side=True)
            print("Server running at http://localhost:{}".format(port))
            httpd.serve_forever()
    except Exception as e:
        print(f"\nError: {e}")

def start_job(type, project, indeces):
    project_subproject = project.split('/')

    # prefix:              type__project__subproject__
    # full name with date: type__project__subproject__date.txt
    job_dirname_prefix = f"{type}__{project.replace('/', '__')}"

    import glob
    if len(glob.glob(f'jobs/active/{job_dirname_prefix}__*/')) > 0:
        # a previous job exists
        return False

    job_dirname = f'{job_dirname_prefix}__{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
    os.makedirs(f'jobs/active/{job_dirname}')

    index_file_path = 'projects/'+project+'/meta/_index/current/xml_files_details.txt'
    if not os.path.isfile(index_file_path):
        print(index_file_path + ' does not exist')
        return None

    index_file = open(index_file_path)
    index = index_file.read()
    # print(index)
    index_file.close()

    indeces_hash = {}
    for i_hex in indeces.split(','):
        indeces_hash[i_hex.lstrip('0')] = True
    # print(indeces_hash)

    files_list_file = open(f'jobs/active/{job_dirname}/files.txt', 'w')

    i=1
    total_byte_size = 0
    for line in index.split('\n'):
        if not f'{i:x}' in indeces_hash:
            i = i + 1
            continue
        # print(f'{line}, {i:x}')
        (tile_id, last_mod, byte_size) = line.replace('\n', '').split('~')
        if 'K' in byte_size:
            total_byte_size = total_byte_size + float(byte_size.strip('K')) * 1000
        elif 'M' in byte_size:
            total_byte_size = total_byte_size + float(byte_size.strip('M')) * 1000 * 1000
        elif 'G' in byte_size:
            total_byte_size = total_byte_size + float(byte_size.strip('G')) * 1000 * 1000 * 1000
        elif is_valid_number(byte_size):
            total_byte_size = total_byte_size + float(byte_size)

        files_list_file.write(tile_id\
          .replace('{prj}', project_subproject[0])\
          .replace('{sprj}', project_subproject[1])\
        )
        i = i + 1
    files_list_file.close()


    cmd_file = open(f'jobs/active/{job_dirname}/cmd.txt', 'w')
    if type == "laz_download":
        print("You selected case 1")
    elif option == "case2":
        print("You selected case 2")
    elif option == "case3":
        print("You selected case 3")
    else:
        print("Invalid option")

    cmd_file.write()
    files_list_file = open(f'jobs/active/{job_dirname}/stats.txt', 'w')
    #  pid=XXXX
    #  size_total=XXX
    #  size_downloaded=XXX
    #  number_total=XXX
    #  number_completed=XXX

def is_valid_number(s):
    try:
        float(s)  # Try to convert the string to a float
        return True
    except ValueError:
        return False


if __name__ == '__main__':
    if len(sys.argv) > 1:
        if sys.argv[1] == 'run':
            start_server(sys.argv[2] if len(sys.argv) > 2 else None)
        elif sys.argv[1] == 'test_start_job':
            start_job(sys.argv[2], sys.argv[3], sys.argv[4])