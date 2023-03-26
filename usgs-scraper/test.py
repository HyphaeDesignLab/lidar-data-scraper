import time
def check():
    print('check')

def run_in_bg():
    last_i = 0
    for i in range(100):
        f = open('run_in_bg.txt', 'a')
        f.write("z" + str(i)+"\n")
        f.close()
        time.sleep(.5)
        last_i = i
    print('%s lines written' % last_i)



import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--cmd', dest='cmd', type=str, help='Specify command')
args = parser.parse_args()

if args.cmd == 'run_in_bg':
    run_in_bg()
else:
    check()