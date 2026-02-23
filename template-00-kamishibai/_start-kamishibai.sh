docker run --rm -it --init -p 8081:8081 \
  --name kamishibai-server \
  -e VOICEVOX_URL=http://localhost:50021 \
  -v "$PWD/kamishibai:/app/kamishibai" \
  kamishibai-server
#  -e VOICEVOX_URL=http://host.docker.internal:50021 \
