. ./utils-stats.sh

# create and cleanup
#  create index_details.txt (to contain last-mod and size)
migrate_scrape_files() {
  local project="$1"
  local project_path='projects'
  if [ "$project" ]; then
    project_path="projects/$project"
  fi
  local index=($(project_index $project))

  for item_i in ${index[@]}; do
    if [ -d project_path/$item_i/_index/backup ]; then
      for backup_dir in $(ls -1 project_path/$item_i/_index/backup/); do
        if [ -d $backup_dir/diff/ ]; then
          if [ -s $backup_dir/diff/added.txt ]; then
            mv $backup_dir/diff/added.txt $backup_dir/diff-added.txt;
          fi
          if [ -s $backup_dir/diff/removed.txt ]; then
            mv $backup_dir/diff/removed.txt $backup_dir/diff-removed.txt;
          fi
          if [ -s $backup_dir/diff/added.txt ]; then
            mv $backup_dir/diff/added.txt $backup_dir/diff-added.txt;
          fi
          if [ -s $backup_dir/diff/changes.txt ]; then
            mv $backup_dir/diff/changes.txt $backup_dir/diff-changed.txt;
          fi
          rm -rf $backup_dir/diff/
        fi
      done
    fi
    local project_arg=$item_i
    if [ "$project" ]; then
       project_arg=$project/$item_i
     fi
    migrate_scrape_files $project_arg
  done
}