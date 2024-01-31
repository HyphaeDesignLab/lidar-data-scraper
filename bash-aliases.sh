#!/bin/bash

_HOME_DIR_LIDAR_SCRAPER=$HOME/$1

function hyphae-github-help {
  echo "Copy and paste these commands to init GITHUB"
  echo 'eval "$(ssh-agent -s)"'
  echo 'ssh-add ~/.ssh/lai-algorithm-training-scraper'
}
hyphae-check-scrapes() {
  ps aux | grep scrape | grep -v grep
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

hyphae_server_pid() {
  ps aux | grep server.py | grep -v grep | sed -E -e 's/^([^ ]+) +([0-9]+) .+/\2/'
}
hyphae_server_status() {
  local pid=$(hyphae_server_pid)
  if [ "$pid" ]; then
    echo "server is running: pid $pid"
  else
    echo 'server is NOT running'
  fi
}
hyphae_server_stop() {
  local pid=$(hyphae_server_pid)
  if [ "$pid" ]; then
    echo "stopping $pid"
    kill -9 $pid
  else
    echo 'no server process to stop'
  fi
}
hyphae_server_start() {
  local pid=$(hyphae_server_pid)
  if [ ! "$pid" ]; then
    nohup python3 $_HOME_DIR_LIDAR_SCRAPER/usgs-scraper/server.py run 1>>$_HOME_DIR_LIDAR_SCRAPER/usgs-scraper/map_server.log 2>>$_HOME_DIR_LIDAR_SCRAPER/usgs-scraper/map_server.error &
  else
    echo "server is already running: pid $pid"
  fi
}

hyphae_server_check_and_restart() {
  local url=$(grep 'server_url' $_HOME_DIR_LIDAR_SCRAPER/usgs-scraper/.env | sed -e 's/server_url=//' | tr -d '\n')

  if ! curl --retry 1 --max-time 5  --connect-timeout 3 -f -s $url/map.html >/dev/null 2>/dev/null; then
    hyphae_server_stop >/dev/null;
    sleep 20; # sleep because the port in use might need to be released before restart
    hyphae_server_start >/dev/null;
  fi;
}