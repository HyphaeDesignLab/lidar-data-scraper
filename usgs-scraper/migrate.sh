. ./utils-stats.sh

# create and cleanup
#  create index_details.txt (to contain last-mod and size)
migrate_backup_dirs() {
  local project="$1"
  local project_path='projects'
  if [ "$project" ]; then
    project_path="projects/$project"
  fi
  local index=($(project_index $project))

  for item_i in ${index[@]}; do
    echo $project/$item_i:
    if [ -d $project_path/$item_i/_index/backup ]; then
      for backup_dir in $(ls -1 $project_path/$item_i/_index/backup/); do
        echo $backup_dir
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
    local current_dir=$project_path/$item_i/_index/current
    if [ -d current_dir/diff/ ]; then
      echo $project/$item_i/diff
      if [ -s $current_dir/diff/added.txt ]; then
        mv $current_dir/diff/added.txt $current_dir/diff-added.txt;
      fi
      if [ -s $current_dir/diff/removed.txt ]; then
        mv $current_dir/diff/removed.txt $current_dir/diff-removed.txt;
      fi
      if [ -s $current_dir/diff/added.txt ]; then
        mv $current_dir/diff/added.txt $current_dir/diff-added.txt;
      fi
      if [ -s $current_dir/diff/changes.txt ]; then
        mv $current_dir/diff/changes.txt $current_dir/diff-changed.txt;
      fi
      rm -rf $current_dir/diff/
    fi
    local project_arg=$item_i
    if [ "$project" ]; then
       project_arg=$project/$item_i
     fi
    migrate_backup_dirs $project_arg
  done
}

if [ "$1" = 'backup_dirs' ]; then
  migrate_backup_dirs
fi