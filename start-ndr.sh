#!/bin/bash

# create static client page in production mode
cd src/client
#npm run build
npm run start
cd -

# create the output directories if they don't exist
mkdir -p src/server/deep-learning/attacks
mkdir -p src/server/deep-learning/models
mkdir -p src/server/deep-learning/trainings
mkdir -p src/server/deep-learning/predictions
mkdir -p src/server/deep-learning/xai
mkdir -p src/server/mmt/outputs

# run server
npm start
