#!/bin/bash

# SCRIPT_DIR=$(cd $(dirname ${BASH_SOURCE:-$0}); pwd)
# cd ${SCRIPT_DIR}/..
# cd dist
INDEX="${1:-slide.html}"
browser-sync start --server --files "*.html" --index ${INDEX}

