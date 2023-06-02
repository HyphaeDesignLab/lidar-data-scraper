test() {
  local i=100
  for ff in $(echo 1 2 3); do
      ((i++))
      echo $i
  done

}
test