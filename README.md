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
nvm install 20
nvm use 20
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
docker tag pdfme-webservice rootzoll/pdfme-webservice:latest
docker push rootzoll/pdfme-webservice:latest
```
