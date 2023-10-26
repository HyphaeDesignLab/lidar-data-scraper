import http.server
import socketserver
import subprocess
import os
import sys
import json
import ssl
import datetime from datetime

def get_env():
    env = {}
    if os.path.isfile('.env'):
        file = open('.env', 'r')
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
        if not self.check_secret():
            return
        if self.path.startswith('/test/post'):
            self.test_post()
        else:
            self.blank_response()

    def do_GET(self):
        if not self.check_secret():
            return

        if self.path.startswith('/test/job'):
            self.test()
        elif self.path.startswith('/test/post'):
            self.test_post_form()
        elif self.path.startswith('/other'):
            self.blank_response()
        else:
            self.blank_response()
    def check_secret(self):
        path_and_query = self.path.split('?') if self.path else [None, None]
        if len(path_and_query) < 2 or not path_and_query[1] or  not 'secret='+env['secret'] in path_and_query[1]:
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

    def test_post(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')
        self.wfile.write((str(len(post_data)) + ', ' + post_data[0:100]).encode('utf-8'))

    def test_post_form(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        content = '<form method="post" action="">' + \
            '<textarea style="display: none;" name="test">' + \
            ('123456789_' * 1650000) + \
            '</textarea><input type="submit" value="Submit"></form>'
        self.wfile.write(content.encode('utf-8'))

    def test(self):
        output = ''

        check_process = subprocess.run('ps aux | grep test/loop.sh | grep -v grep | tr -d "\n"', stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        cmd = ["tests/loop.sh"]
        child_pid = None
        try:
            process = subprocess.Popen(
                ['nohup'] + cmd,
                shell=True
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                text=True
            )
        except Exception as e:
            output = f"Error starting the process: {e}"
            print(output)
        else:
            # The child process is running in the background and will continue to run
            # even if the Python process terminates.

            # Optionally, you can get the PID of the child process
            child_pid = process.pid
            output = f"Child process PID: {child_pid}"
            print(output)

        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(f'running test loop in background {child_pid}'.encode('utf-8'))

def start_server():
    with socketserver.TCPServer(("", int(env['port'])), ScraperServer) as httpd:
        if 'ssl' in env and env['ssl'] == 'true':
            httpd.socket = ssl.wrap_socket(httpd.socket, keyfile=env['ssl_cert_key_file'], certfile=env['ssl_cert_file'], server_side=True)
        print("Server running at http://localhost:{}".format(int(env['port'])))
        httpd.serve_forever()

def start_job(type, project, indeces):
    project_subproject = project.split('/')

    # prefix:              type__project__subproject__
    # full name with date: type__project__subproject__date.txt
    job_dirname_prefix = f'{type}__{project.replace('/', '__')}'

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
            start_server()
        elif sys.argv[1] == 'test_start_job':
            start_job(sys.argv[2], sys.argv[3], sys.argv[4])