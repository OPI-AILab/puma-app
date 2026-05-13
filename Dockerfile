FROM python:3.12-slim

COPY requirements.txt requirements.txt
RUN apt update  \
    && apt install -y unzip python3-pip python3-setuptools sudo pandoc \
    && pip install -r requirements.txt
