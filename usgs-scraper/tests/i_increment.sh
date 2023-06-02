test() {
  local i=100
  for ff in $(echo 1 2 3); do
      i=$(expr $i+1)
      echo $i
  done

}
test