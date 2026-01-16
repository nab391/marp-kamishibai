cd "$(dirname "$0")"
docker run --rm \
  -v "$PWD/src:/src" \
  -v "$PWD/dist:/dist" \
  marp-docker "$@"

