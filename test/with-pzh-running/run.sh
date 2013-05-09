#! /bin/bash
################################################################################
#  Code contributed to the webinos project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# Copyright 2013 John Lyle, University of Oxford
################################################################################

# To be run from the root directory of the module
# But will create directories outside, so watch out!

# Fail if anything fails
set -e

export PZHWS_DIR=`pwd`
export TMP=~/tmp
export WEBINOS_PZH_DIR=$TMP/webinos-pzh
export EXISTING_PZHWS_DIR=$WEBINOS_PZH_DIR/node_modules/webinos-pzhWebServer


# move to a temporary directory 
mkdir -p $TMP
cd $TMP
echo "Made directory $TMP " 


# Empty it, and check out the PZH
if [ -d "$WEBINOS_PZH_DIR" ]; then
  rm -rf $WEBINOS_PZH_DIR
  echo "Deleted directory $WEBINOS_PZH_DIR"
fi

# clone the PZH and move into its directory
git clone https://github.com/webinos/webinos-pzh.git $WEBINOS_PZH_DIR
cd $WEBINOS_PZH_DIR
echo "Cloned the PZH into $WEBINOS_PZH_DIR " 


# set the ports on the PZH
sed -i 's/\(\s*"provider"\s*:\)\s*[0-9]*,/\16080,/' $WEBINOS_PZH_DIR/config.json
sed -i 's/\(\s*"provider_webServer"\s*:\s*\)[0-9]*/\16443/' $WEBINOS_PZH_DIR/config.json


# install the PZH and save dependencies
npm install --save-dev
echo "Installed the PZH" 


# delete the existing PZHWS module.
if [ -d "$EXISTING_PZHWS_DIR" ]; then
  rm -rf $EXISTING_PZHWS_DIR
  echo "Deleted directory ${EXISTING_PZHWS_DIR}"
fi

# copy our version of the PZH WS
cp -r $PZHWS_DIR $EXISTING_PZHWS_DIR


# start the PZH
echo "Starting the PZH"
node ./webinos_pzh.js &


# wait 5 secs for it to start
sleep 5
echo "Started the PZH and waited, now invoking jasmine" 


# run the node test script
# note that we're in the webinos-pzh directory at the moment.
cd $PZHWS_DIR
jasmine-node ./test/with-pzh-running/
