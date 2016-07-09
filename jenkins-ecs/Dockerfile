FROM jenkins

# COPY config.xml /usr/share/jenkins/ref/
COPY plugins.txt /usr/share/jenkins/ref/

RUN /usr/local/bin/plugins.sh /usr/share/jenkins/ref/plugins.txt

USER root

RUN curl "https://bootstrap.pypa.io/get-pip.py" -o "get-pip.py"
RUN python get-pip.py

RUN pip install awscli

COPY aws /var/jenkins_home/.aws

RUN chown -R jenkins:jenkins /var/jenkins_home/

RUN git config --global user.name "jenkins-ci"
RUN git config --global user.email "kzollicoffer@icloud.com"
RUN git config --global credential.helper '!aws codecommit credential-helper $@'
RUN git config --global credential.useHttpPath true
