import re

line = '''
<img src="/icons/folder.gif" alt="[DIR]"> <a href="WI_Statewide_2021_B21/">WI_Statewide_2021_B21/</a>  2023-02-10 11:13  -
'''
regex = re.compile('<img[^>]+alt="\[DIR\]">\s*<a href="([^"]+)">[^<]+</a>\s+(\d{4}-\d\d-\d\d \d\d:\d\d)', re.IGNORECASE)

match = regex.search(line)

print (match)
print (match.group(0))
print(match.group(1))
print(match.group(2))

