import os
import sys
import time

import subprocess

os.chdir(os.path.dirname(__file__))

worker_id = 2
batch_count = 10
job_id = 1

worker_dir = f'jobs/{job_id}/workers/{worker_id}'
output_dir = f'jobs/{job_id}/output'
error_dir = f'jobs/{job_id}/errors'
subprocess.check_output(f'mkdir -p {output_dir}')
subprocess.check_output(f'mkdir -p {error_dir}')

if not os.path.isdir(worker_dir):
    print(f'worker dir jobs/{job_id}/workers/{worker_id} NOT found, exiting...' )
    sys.exit()
    
while True:
    

    tasks = subprocess.check_output(f'ls {worker_dir}', shell=True).decode('utf-8').strip().split('\n')
    
    if not tasks or not len(tasks):
        time.sleep(10)
        continue
    else:
        time.sleep(3)
    
    # parse worker task dirs
    for task_file_name in tasks:
        task_file_name = task_file_name.replace('\n', '').strip()
        task_file = open(task_file_name)
        task = task_file.readline()

        # skip empty lines
        if not task:
            continue

        task_pieces = task.split(':', 1)
        output_file_name = task_pieces[0]
        cmd = task_pieces[1]

        output = subprocess.check_output(f'{cmd} > {output_dir}/{output_file_name} 2> {error_dir}/{output_file_name}', shell=True).decode('utf-8').strip()
        subprocess.check_output(f'rm {worker_dir}/{task_file_name}', shell=True)

        time.sleep(1)
