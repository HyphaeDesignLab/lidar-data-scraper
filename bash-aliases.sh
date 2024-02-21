#!/bin/bash

_HOME_DIR_LIDAR_SCRAPER=$HOME/$1

function hyphae_github_help {
  echo "Copy and paste these commands to init GITHUB"
  echo 'eval "$(ssh-agent -s)"'
  echo 'ssh-add ~/.ssh/lai-algorithm-training-scraper'
}
hyphae_check_scrapes() {
  ps aux | grep scrape | grep -v grep
}

function hyphae_github_repo_init {
  hyphae_github_help;
  read -p 'Did you run those commands already? (y/n): ' zzz
  if [ "$zzz" = 'y' ]; then
    git clone git@github.com:hyphae-lab/lai-algorithm-training-scraper.git
  fi;
}
function hyphae_github_ssh_init {
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
function hyphae_github_pull {
   cd $HOME/lai-algorithm-training-scraper
   hyphae_github_ssh_init;

   echo ssh agent: $SSH_AGENT_PID
   git pull

   # self update bash aliases and re-load
   cp ./bash-aliases.sh $HOME/.bash_aliases
   . $HOME/.bash_aliases
}
function hyphae_self_update {
   cd $HOME/lai-algorithm-training-scraper
   hyphae_github_ssh_init;
   echo ssh agent: $SSH_AGENT_PID
   git pull
   # self update bash aliases and re-load
   . $HOME/.bash_aliases
}

hyphae_help() {
    echo 'Sample usage of Hyphae util functions: '
    echo ' hyphae_github_help ';
    echo ' hyphae_github_repo_init ';
    echo ' hyphae_github_ssh_init ';
    echo ' hyphae_github_pull ';
    echo ' hyphae_self_update ';

}

hyphae_server_status() {
  # https://pm2.keymetrics.io/docs/usage/quick-start/
  pm2 status lidar-scraper-server
  pm2 describe lidar-scraper-server
}
hyphae_server_stop() {
  # https://pm2.keymetrics.io/docs/usage/quick-start/
  pm2 stop lidar-scraper-server
}
hyphae_server_start() {
  # https://pm2.keymetrics.io/docs/usage/quick-start/
  pm2 start lidar-scraper-server
}

hyphae_server_check_and_restart() {

  local url=$(grep 'server_url' $_HOME_DIR_LIDAR_SCRAPER/usgs-scraper/.env | sed -e 's/server_url=//' | tr -d '\n')

  if ! curl --retry 1 --max-time 5  --connect-timeout 3 -f -s $url/map.html >/dev/null 2>/dev/null; then
    # https://pm2.keymetrics.io/docs/usage/quick-start/
    pm2 restart lidar-scraper-server
  fi;
}

#  Run functions directly, where aliases are not available (e.g. crontab)
if [ "$2" = 'hyphae_server_check_and_restart' ]; then
  hyphae_server_check_and_restart;
fi;