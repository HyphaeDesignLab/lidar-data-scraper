HOME_DIR_SENSORS=$HOME/lai-algorithm-training-scraper
function hyphae-github-help {
  echo "Copy and paste these commands to init GITHUB"
  echo 'eval "$(ssh-agent -s)"'
  echo 'ssh-add ~/.ssh/lai-algorithm-training-scraper'
}
hyphae-check-scrapes() {
  ps aux | grep scrape
}
hyphae-stop-scrapes() {
  for projects_dir in $(find ./ -mindepth 2 -maxdepth 2 -type d -name 'projects' ); do
    echo > $projects_dir/STOP_SCRAPE.txt
  done;
}

function hyphae-github-repo-init {
  hyphae-github-help;
  read -p 'Did you run those commands already? (y/n): ' zzz
  if [ "$zzz" = 'y' ]; then
    git clone git@github.com:hyphae-lab/lai-algorithm-training-scraper.git
  fi;
}
function hyphae-github-ssh-init {
   if [ "$(ps aux | grep ssh-agent | grep -v grep)" != "" ]; then
	  pidsToKill="$(ps aux | grep ssh-agent | grep -v grep | sed -E -e 's/^[a-z]+ +([0-9]+) +.+$/\1/' -e s/$SSH_AGENT_PID//)"
	  kill $pidsToKill
   fi

   if [ "$(ps aux | grep ssh-agent | grep -v grep | grep $SSH_AGENT_PID)" = "" ]; then
	   unset SSH_AGENT_PID
   fi
   if [ "$SSH_AGENT_PID" = "" ]; then
	  eval "$(ssh-agent -s)"
	  ssh-add $HOME/.ssh/lai-algorithm-training-scraper
	  echo $SSH_AGENT_PID
   fi
}
function hyphae-github-pull {
   cd $HOME/lai-algorithm-training-scraper
   hyphae-github-ssh-init;

   echo ssh agent: $SSH_AGENT_PID
   git pull

   # self update bash aliases and re-load
   cp ./bash-aliases.sh $HOME/.bash_aliases
   . $HOME/.bash_aliases
}
function hyphae-self-update {
   cd $HOME/lai-algorithm-training-scraper
   hyphae-github-ssh-init;
   echo ssh agent: $SSH_AGENT_PID
   git pull
   # self update bash aliases and re-load
   cp ./bash-aliases.sh $HOME/.bash_aliases
   . $HOME/.bash_aliases
}

hyphae-help() {
    echo 'Sample usage of Hyphae util functions: '
    echo ' hyphae-github-help ';
    echo ' hyphae-github-repo-init ';
    echo ' hyphae-github-ssh-init ';
    echo ' hyphae-github-pull ';
    echo ' hyphae-self-update ';

}