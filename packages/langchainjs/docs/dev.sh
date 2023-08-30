#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail
set -o xtrace

SCRIPT_DIR="$(cd "$(dirname "$0")"; pwd)"
cd "${SCRIPT_DIR}"

rm -rf _dist/
mkdir -p _dist/docs_skeleton
cp -r {docs_skeleton,snippets} _dist
cp -r extras/* _dist/docs_skeleton/docs
cd _dist/docs_skeleton
yarn install
yarn start