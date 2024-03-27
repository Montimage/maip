# Montimage AI Platform (MAIP)
Montimage's AI Platform (**MAIP**) provides users with easy access to developed AI services  through a friendly and intuitive **user interface** and **APIs**. It provides a range of **ML services**, including feature extraction, building or retraining AI models, injecting adversarial attacks, producing explanations, and evaluating the models using different datasets. Each of these services has a dedicated **API** that can be accessed through the server, making it easy to integrate with other applications and systems.

## Architecture
![Architecture of our framework](MAIP_architecture.png)

The above figure shows the architecture of our MAIP framework, that includes the following main components:
- **Data acquisition** module collects raw traffic data from networks or IoT testbed in either online or offline mode. It can also use Cyber Threat Intelligence (CTI) sources, e.g., deployed honeypots, to learn and continuously train our model using attack patterns and past malware information in the database.
- **Data analysis \& processing** module employs our [Montimage monitoring tool (MMT)](https://github.com/Montimage/mmt-probe) to parse a wide range of network protocols (e.g., TCP, UDP, HTTP, and more than 700) and extract flow-based features. Then, the restructured and computed data is transformed into a numeric vector so that can be easily processed by our AI model.
- **AI models** module is responsible for creating and utilizing ML models able to classify the vectorized form of network traffic data for different purposes, such as user activity classification, malware detection in encrypted traffic or root cause analysis.
- **Adversarial attacks** module injects various evasion and poisoning adversarial attacks for robustness analysis of our system.
- **Explainable AI** module aim at producing post-hoc global and local explanations of predictions of our model.
- **Metrics** module allows to measure quantifiable metrics for its accountability and resilience.
- **Defense mechanisms** module provides countermeasures to prevent attacks against both AI and XAI models.

Overall our framework is designed with a server written in ExpressJS, that employs the MMT tool written in C for feature extraction and leverages popular Python libraries for DL and XAI. The client is built in React and accessible via Swagger APIs, offering users an intuitive and user-friendly interface to interact with the DL services.

## Getting Started
Tested environment: Ubuntu 20.04.6 LTS - focal.
```
git clone https://github.com/Montimage/maip.git
cd maip

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
./start-maip.sh

# Access the application on http://localhost:31057
```

Under construction documentation is available here: https://strongcourages-organization.gitbook.io/maip-documentation/

Video demo: https://drive.google.com/file/d/1R2_FHzx1cvv7DMvlbexSeBz_AcxsHrQi/view?usp=sharing

## References
Nguyen, M. D., Bouaziz, A., Valdes, V., Rosa Cavalli, A., Mallouli, W., & Montes De Oca, E. (2023, August). A deep learning anomaly detection framework with explainability and robustness. In Proceedings of the 18th International Conference on Availability, Reliability and Security (pp. 1-7).

Sandeepa, C., Senevirathna, T., Siniarski, B., Nguyen, M. D., La, V. H., Wang, S., & Liyanage, M. (2023, August). From opacity to clarity: Leveraging xai for robust network traffic classification. In International Conference on Asia Pacific Advanced Network (pp. 125-138). Cham: Springer Nature Switzerland.

Nguyen, M. D., La, V. H., Mallouli, W., Cavalli, A. R., & Oca, E. M. D. (2023). Toward Anomaly Detection Using Explainable AI. In CyberSecurity in a DevOps Environment: From Requirements to Monitoring (pp. 293-324). Cham: Springer Nature Switzerland.

