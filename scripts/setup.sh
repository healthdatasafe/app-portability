#!/bin/sh

# This script sets up the app-portability build environment.

# working dir fix
scriptsFolder=$(cd $(dirname "$0"); pwd)
cd $scriptsFolder/..

# check for well known prereqs that might be missing
hash git 2>&- || { echo >&2 "I require git."; exit 1; }
hash npm 2>&- || { echo >&2 "I require node and npm."; exit 1; }

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js >= 20 required (found $(node -v))"
  exit 1
fi

echo "
Installing Node modules from 'package.json' if necessary...
"
npm install

if [ ! -d dist/.git ]
then
  echo "
Setting up 'dist' folder for publishing to GitHub pages (dev)...
"
  rm -rf dist
  git clone -b gh-pages git@github.com:healthdatasafe/app-portability.git dist || \
    echo "(gh-pages branch does not exist yet — first deploy will create it)"
fi

if [ ! -d distprod/.git ]
then
  echo "
Setting up 'distprod' folder for publishing to production (portability.hds.ngo)...
"
  git clone git@github.com:healthdatasafe/app-portability-prod.git distprod
fi

echo "


If no errors were listed above, the setup is complete.
See the README for more info on writing and publishing.
"
