import os
import sys

if len(sys.argv) <= 2:
    print('need an argument with the backup directory path')
    sys.exit(1)

old_index_filepath=sys.argv[1]
new_index_filepath=sys.argv[2]
new_index_dir=sys.argv[3]

if not os.path.isfile(new_index_filepath):
    print('new index file not found '+new_index_filepath)
    sys.exit(0)
if not os.path.isfile(old_index_filepath):
    print('old index file not found '+ old_index_filepath)
    sys.exit(0)

new_index_details__file=open(new_index_filepath)
old_index_details__file=open(old_index_filepath)

new_index={}
old_index={}

for line in new_index_details__file:
    line = line.replace('\n', '')
    (name, last_mod, size) = line.split('~')
    new_index[name]=[last_mod, size]
new_index_details__file.close()

for line in old_index_details__file:
    line = line.replace('\n', '')
    (name, last_mod, size) = line.split('~')
    old_index[name]=[last_mod, size]
old_index_details__file.close()

new_index__set = set(new_index.keys())
old_index__set = set(old_index.keys())

added = list(new_index__set.difference(old_index__set))
removed = list(old_index__set.difference(new_index__set))
same = list(new_index__set.intersection(old_index__set))

added.sort()
added__file = open(new_index_dir+'/diff-added.txt', 'w')
added__file.writelines('\n'.join(added)+'\n')
added__file.close()

removed.sort()
removed__file = open(new_index_dir+'/diff-removed.txt', 'w')
removed__file.write('\n'.join(removed)+'\n')
removed__file.close()

updated_count=0
updated=[]
for name in same:
    if new_index[name][0] != old_index[name][0] or new_index[name][1] != old_index[name][1]:
        updated.append('%s~%s%s:::%s~%s' % (name, old_index[name][0], old_index[name][1], new_index[name][0], new_index[name][1]))
updated.sort()


updated__file = open(new_index_dir+'/diff-updated.txt', 'w')
updated__file.write('\n'.join(updated)+'\n')
updated__file.close()

summary__file = open(new_index_dir+'/diff.txt', 'w')
summary__file.write('previous: %d \n' % len(old_index__set))
summary__file.write('current: %d \n' % len(new_index__set))
summary__file.write('added: %d \n' % len(added))
summary__file.write('removed: %d \n' % len(removed))
summary__file.write('updated: %d \n' % len(updated))
