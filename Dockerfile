FROM ubuntu:20.04
# USER root
ARG DEBIAN_FRONTEND=noninteractive
# Create app directory
# WORKDIR /usr/src/app
# Install some useful packages
# RUN apt-get autoclean -y
# RUN apt-get autoremove -y
# RUN apt-get update --fix-missing -y
COPY . ./maip-app
RUN apt-get update -y
RUN apt-get install -y git wget cmake gcc g++ cpp curl software-properties-common

# INSTALL DEEP LEARNING MODULE
# Install python3.9
RUN add-apt-repository ppa:deadsnakes/ppa -y
RUN apt-get update -y
RUN apt-get install python3.9 python3.9-venv -y
RUN python3.9 --version
# Install pip3.9
RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
RUN python3.9 get-pip.py
RUN pip3.9 --version
# Install dependencies
RUN apt-get install -y graphviz
RUN pip3.9 install -r maip-app/src/server/deep-learning/requirements.txt
# TODO: run some python tests
#RUN python3.9 -m unittest
# INSTALL NODEJS SERVER
RUN apt-get update -y
RUN curl -sL https://deb.nodesource.com/setup_19.x | bash
RUN apt-get install -y nodejs
RUN npm install pm2 -g

RUN cd maip-app/ && npm install
RUN cd maip-app/src/client && npm install
# TODO: run some nodejs tests

# INSTALL MMT
RUN apt-get update -y
RUN apt-get install -y libconfuse-dev libpcap-dev libxml2-dev net-tools
RUN ldconfig
# # Copy resources
# # COPY ./mmt-packages .
RUN dpkg -i maip-app/mmt-packages/mmt-dpi*.deb
RUN dpkg -i maip-app/mmt-packages/mmt-security*.deb
RUN dpkg -i maip-app/mmt-packages/mmt-probe*.deb 2>/dev/null||true
RUN ldconfig

WORKDIR ./maip-app/

EXPOSE 31057
CMD ./start-maip.sh