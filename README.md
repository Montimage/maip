# Montimage AI Platform (MAIP)
MAIP enables security operators to protect network infrastructures using rule-based detection and advanced machine learning models to detect and respond to network threats and anomalies in (near) real time. It also provides capabilities for performing adversarial attacks and mechanisms to assess the robustness and accountability of AI models. Additionally, MAIP supports automated responses through integration with Security Orchestration, Automation, and Response (SOAR) platforms. By integrating widely used Explainable AI (XAI) techniques, such as SHAP and LIME, as well as Large Language Models (LLMs), the tool helps security operators better understand alerts, identify malicious traffic flows, and receive recommended mitigation actions.

## Installation
### Build from Docker
```bash
# Clone the repo
git clone https://github.com/Montimage/maip.git
cd maip

# Copy the Docker configuration template
cp env.example .env

# (Optional) Edit .env if you need to customize:
# - NATS_URL: If using NATS messaging (default: nats://nats:4222)
# - NATS_SUBJECT: Topic for publishing data
# - REACT_APP_API_URL: If accessing from other machines (default: http://localhost:31057)

# Build and run the Docker stack
docker-compose build
docker-compose up -d

# Access the application on http://localhost:3000
```
