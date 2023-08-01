#!/bin/bash

# Ubuntu 20.04.6 LTS - focal
#git clone https://github.com/Montimage/maip.git
#cd maip

# Install some packages 
sudo apt-get update -y
sudo apt install -y git wget cmake gcc g++ cpp curl software-properties-common

# Install Python ML libraries (Python 3.8.10, pip 20.0.2)
sudo apt install -y python3-pip graphviz
pip3 install src/server/deep-learning/requirements.txt

# Install mmt tools
sudo apt install -y libconfuse-dev libpcap-dev libxml2-dev net-tools
sudo ldconfig
sudo dpkg -i src/server/mmt-packages/mmt-dpi*.deb
sudo dpkg -i src/server/mmt-packages/mmt-security*.deb
sudo dpkg -i src/server/mmt-packages/mmt-probe*.deb 2>/dev/null||true

# Install nodejs v19.9.0
sudo apt-get update -y
curl -sL https://deb.nodesource.com/setup_19.x | bash
sudo apt install -y nodejs

# Install server
npm install
cp env.example .env

# Run server
# ./start-maip.sh

# Install client
cd src/client
npm install # --force
cd ../../

# Run client
# ./start-client.sh