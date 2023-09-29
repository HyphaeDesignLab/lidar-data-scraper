wc -l ./projects/*/*/_index/current/index.txt ./projects/*/_index/current/index.txt \
 | grep -E '^ *0 ' \
 | sort > scrape-check-empty-index.txt

for fff in $(wc -l ./projects/*/*/meta/*xml* ./projects/*/meta/*xml* \
 | grep -E '^ *[0-9] ' \
 | sed -E -e 's/^ *[0-9] (.+)xml_files.txt.*$/\1/'); \
 do
  wc -l $fff/zip_files.txt;
  wc -l $fff/xml_files.txt;
  echo
done > scrape-check-empty-xml-with-zip-compare.txt

wc -l ./projects/*/*/meta/*xml* ./projects/*/meta/*xml* \
 | grep -E '^ *[0-9]{1} ' \
 | sort > scrape-check-empty-xml.txt
