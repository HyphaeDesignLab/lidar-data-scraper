test_loop_increment() {
  local i
  for i in $(seq 1 100); do
      echo -n "$i," >> loop.txt
      sleep 10
  done
}
test_loop_increment