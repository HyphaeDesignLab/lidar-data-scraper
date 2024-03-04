import os
import sys
import time

import subprocess

os.chdir(os.path.dirname(__file__))

worker_count = 10
batch_count = 10
job_id = 1

if not os.path.isfile(f'jobs/{job_id}/tasks.txt'):
    print(f'jobs/{job_id}/tasks.txt file NOT found, exiting...' )
    sys.exit()
    
tasks_count = subprocess.check_output(f'wc -l jobs/{job_id}/tasks.txt', shell=True).decode('utf-8').strip().split(' ')[0]
if tasks_count:
    tasks_count = int(tasks_count)
else:
    print(f'cant open jobs/{job_id}/tasks.txt')

last_task_index = 0

has_more_tasks = tasks_count > 0

while has_more_tasks:
    time.sleep(3)

    # make bash command to list all workers 1 to X folders within job Y
    worker_tasks_prefix = f'jobs/{job_id}/worker-'
    worker_tasks_folders = ' '.join([ f'{worker_tasks_prefix}{i+1}' for i in range(0,worker_count)])
    # execute command ls worker_task_dir1 worker_task_dir2 ...
    #   return format is
    #      worker_task_dir_1:
    #         file1
    #         ...more files per line
    #      <emptyline between every folder>
    #      worker_task_dir_X:
    #         ...
    worker_task_list = subprocess.check_output(f'ls {worker_tasks_folders}', shell=True).decode('utf-8').strip()
    
    worker_tasks = {}
    current_worker_id = None

    # parse worker task dirs
    for line in worker_task_list.split('\n'):
        line = line.replace('\n', '').strip()

        # skip empty lines
        if not line:
            continue

        # if the line is worker_task_dir_X and contains colon ':', must be the beginning of the folder section
        if worker_tasks_prefix in line and ':' in line:
            current_worker_id = line.replace(worker_tasks_prefix, '').replace(':', '')
            worker_tasks[current_worker_id] = []
            continue

        # add task to worker task list
        worker_tasks[current_worker_id].append(line)
    del current_worker_id

    for worker_id in worker_tasks:
        print(f'worker {worker_id} has {len(worker_tasks[worker_id])} jobs')
        if len(worker_tasks[worker_id]) == 0:
            tasks_remaining_count = tasks_count - last_task_index
            next_batch_count = min(batch_count, tasks_remaining_count)
            next_task_index = last_task_index + next_batch_count
            next_tasks = subprocess.check_output(f'head -{next_task_index} jobs/{job_id}/tasks.txt | tail -{next_batch_count}', shell=True).decode('utf-8').strip().split('\n')
            for task in next_tasks:
                task = task.strip()
                print(f'new task: {task}')
                task_file = open(f'{worker_tasks_prefix}{worker_id}/{task}', 'w')
                task_file.write(task)
                task_file.close()

            last_task_index = next_task_index
            print(f'worker {worker_id} has {len(worker_tasks[worker_id])} jobs')
    del worker_id

    print(len(worker_tasks), next_task_index)
    
    

# parent checks tasks and adds X more for every worker bin that's empty
# worker goes through tasks and puts them on queue (IN PROGRESS); flips them to DONE