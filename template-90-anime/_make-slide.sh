cd "$(dirname "$0")"
docker run --rm \
  -v "$PWD:/src" \
  -v "$PWD:/dist" \
  marp-docker "$@"


