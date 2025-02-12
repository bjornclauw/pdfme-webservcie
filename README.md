# PDFme Webservice

A stateless REST API service that wraps the [PDFme](https://pdfme.com/) template engine to generate PDFs from templates.

PDFme template + input values --> Generated PDF 

## Features

- Generate PDFs from PDFme templates
- Stateless architecture
- Docker support
- Swagger API documentation
- Query parameter support for template variables
- Easy to deploy and scale
- Using PDFme default fonts

## Install from DockerHub

```
docker pull rootzoll/pdfme-webservice:latest
docker run --name pdfme-webservice -p 6439:6439 rootzoll/pdfme-webservice:latest
```

## Install Docker Compose

```
version: "3.3"
services:
  pdfme-webservice:
    container_name: pdfme-webservice
    restart: unless-stopped
    ports:
      - 6439:6439
    image: rootzoll/pdfme-webservice:latest
networks: {}
```

## Installation for local Development & Docker Build

### Prerequisites

- Node.js >= 20.0.0
- npm
- nvm (recommended)
- Docker (optional)

### Local install & build

1. Clone the repository:

In the project directory:

```
nvm use
npm install
```

### Running Locally

```
npm start
```

or during development with auto-reload:

```
npm run dev
```

The service will be available at:

- API: http://localhost:6439
- Swagger Documentation: http://localhost:6439/api-docs

### Docker Deployment

```
docker build -t pdfme-webservice .
docker run --name pdfme-webservice -p 6439:6439 pdfme-webservice
```

### Project Maintanace

When a new docker version was build - upload image to docker hub:

```
docker buildx build --platform linux/amd64,linux/arm64 -t rootzoll/pdfme-webservice:latest --push .
```
