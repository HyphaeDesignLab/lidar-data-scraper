import os
import sys

base_dir=os.path.dirname(__file__)

index_file_path=sys.argv[1]

file=open(index_file_path, 'r')

states_file=open(base_dir+'/states.txt', 'r')

state_names={}
state_abbrs=[]
digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
for line in states_file:
    (name, abbr) = line.replace('\n', '').split('~')
    name = name.replace(' ', '').lower()
    abbr = abbr.upper()
    state_abbrs.append(abbr)
    state_names[name] = abbr

for line in file:
    (original,project_date) = line.replace('\n', '').split('~')
    project_date=project_date.replace(' ', 'T')
    all_underscores = original.replace('-', '_').lower()
    # for searching two-word states
    two_word_join = []
    words = all_underscores.split('_')

    years_found=[]

    state_found=None
    for i, word in enumerate(words):

        # for searching two-word states
        two_word_join.append(word)
        if i != 0:
            two_word_join.append(words[i-1]+words[i])

        if not state_found and len(word) == 2:
            state = word.upper()
            if state in state_abbrs:
                state_found=state


        if len(word) == 4:
            if word[0:2] == '20' and word[2] in digits and word[3] in digits:
                years_found.append(word)


    if not state_found:
        for word in two_word_join:
            if word in state_names:
                state_found=state_names[word]
    if not state_found:
        state_found='none'

    if not years_found:
        years_found.append('none')

    print('%s~%s~%s~%s' % (original, state_found, '-'.join(years_found), project_date ) )

