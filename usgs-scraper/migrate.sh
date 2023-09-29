. ./utils.sh
. ./utils-stats.sh

# create and cleanup
#  create index_details.txt (to contain last-mod and size)
cleanup_backup_diffs_dirs() {
    local ddir="$1"
    local backup_dir='';
    for backup_dir in $(ls -1 $ddir); do
      echo $backup_dir
#        if [ -d $backup_dir/diff/ ]; then
#          if [ -s $backup_dir/diff/added.txt ]; then
#            mv $backup_dir/diff/added.txt $backup_dir/diff-added.txt;
#          fi
#          if [ -s $backup_dir/diff/removed.txt ]; then
#            mv $backup_dir/diff/removed.txt $backup_dir/diff-removed.txt;
#          fi
#          if [ -s $backup_dir/diff/added.txt ]; then
#            mv $backup_dir/diff/added.txt $backup_dir/diff-added.txt;
#          fi
#          if [ -s $backup_dir/diff/changes.txt ]; then
#            mv $backup_dir/diff/changes.txt $backup_dir/diff-changed.txt;
#          fi
#          rm -rf $backup_dir/diff/
#        fi
    done
}

if [ "$1" = 'backup_dirs_cleanup' ]; then
  loop_on_projects '' cleanup_backup_diffs_dirs '%s/_index/backup' 20
fi