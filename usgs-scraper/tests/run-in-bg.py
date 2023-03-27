import time

last_i = 0
for i in range(100):
    f = open('run-in-bg.txt', 'a')
    f.write("z" + str(i)+"\n")
    f.close()
    time.sleep(.5)
    last_i = i
print('%s lines written' % last_i)
