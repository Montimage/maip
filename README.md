# Network Detection and Response (NDR)
Network Detection and Response (NDR) component provides an anomaly detection and response capability for (encrypted) network traffic. NDR includes an Explainable AI (XAI) capability to enable root cause analysis (RCA) of detected anomalies. Responses can be automatically triggered through the Mitigation Manager.

## Installation
### Build from source
Tested environment: Ubuntu 20.04.6 LTS - focal.
```
git clone https://github.com/resilmesh2/Network-Detection-Response.git
cd Network-Detection-Response 

# Install some packages
sudo apt-get update -y
sudo apt install -y git wget cmake gcc g++ cpp curl software-properties-common

# Install Python ML libraries (Python 3.8.10, pip 20.0.2)
sudo apt install -y python3-pip graphviz
pip3 install src/server/deep-learning/requirements.txt

# Install MMT tools
sudo apt install -y libconfuse-dev libpcap-dev libxml2-dev net-tools
sudo ldconfig
sudo dpkg -i src/server/mmt-packages/mmt-dpi*.deb
sudo dpkg -i src/server/mmt-packages/mmt-security*.deb
sudo dpkg -i src/server/mmt-packages/mmt-probe*.deb 2>/dev/null||true

# Install Node.js v19.9.0
sudo apt-get update -y
curl -sL https://deb.nodesource.com/setup_19.x | bash
sudo apt install -y nodejs

# Install the server
cd src/server
npm install
cd -
cp env.example .env

# Install the client
cd src/client
npm install --force
cd -

# Run the application
./start-ndr.sh

# Access the application on http://localhost:31057
```

### Build from Docker
```
git clone https://github.com/resilmesh2/Network-Detection-Response.git
cd Network-Detection-Response

# Run and build docker images
sudo docker-compose build
sudo docker-compose up
```