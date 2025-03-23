const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');
const { text, image, barcodes } = require('@pdfme/schemas');
const { generate } = require('@pdfme/generator');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');
const axios = require('axios');
const { Buffer } = require('buffer');

// Configure multer for PDF file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024  // Limit to 10MB
  }
});

const app = express();
const port = process.env.PORT || 6439;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));  // Add text body parser

// Base64 encoded minimal blank PDF (A4 size, no content)
const BLANK_PDF = 'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgNTk1IDg0MiBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSIAogICAgPj4KICA+PgogIC9Db250ZW50cyA1IDAgUgo+PgplbmRvYmoKCjQgMCBvYmoKPDwKICAvVHlwZSAvRm9udAogIC9TdWJ0eXBlIC9UeXBlMQogIC9CYXNlRm9udCAvVGltZXMtUm9tYW4KPj4KZW5kb2JqCgo1IDAgb2JqICAlIHBhZ2UgY29udGVudAo8PAogIC9MZW5ndGggMAo+PgpzdHJlYW0KZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAxIDAwMDAwIG4gCjAwMDAwMDAzODAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDkyCiUlRU9G';

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'pdfme-webservice',
      version: '1.0.0',
      description: 'Stateless API service for generating PDFs using PDFme templates',
    },
  },
  apis: ['./src/index.js'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Redirect root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

/**
 * @swagger
 * /generate-pdf:
 *   post:
 *     summary: Generate PDF with image included
 *     parameters:
 *       - in: query
 *         name: input values
 *         schema:
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: form
 *         explode: true
 *         description: Use key-value parameter in the URL query as inputs to override PDF template field values (only string value supported)
 *         example:
 *           name: "John Doe"
 *           company: "ACME Inc"
 *           date: "2024-04-10"
 *     requestBody:
 *       required: true
 *       description: |
 *         Use the template JSON generated and downloaded from https://pdfme.com/template-design as request body
 *         
 *         Example workflow:
 *         1. Go to pdfme.com/template-design
 *         2. Design your template and add variables
 *         3. Download the template JSON
 *         4. Use this JSON as request body
 *         
 *         Note: You can override any template variable using query parameters. If you dont want to use query parameters you can also add the key-value pairs object under "inputs" as an additional root of the request body json object 
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Generated PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid input parameters
 *       500:
 *         description: Server error
 */
app.post('/generate-pdf', async (req, res) => {
  try {
    const { schemas, inputs = {} } = req.body;

    if (!schemas) {
      return res.status(400).json({ 
        error: 'Template schema is required' 
      });
    }

    // Create the template object in the format expected by pdfme
    const template = {
      basePdf: BLANK_PDF,
      schemas
    };

    // Merge query parameters with body inputs (query params take precedence)
    const mergedInputs = {
      ...inputs,
      ...req.query
    };

    // Create a single inputs array with one object containing all field values
    const templateInputs = [{}];  // Single input object for all pages
    
    // Collect all field values across all pages into the single input object
    schemas.forEach((page, pageIndex) => {
      page.forEach(field => {
        if (field.type === 'image' && field.src) {
          // If image field is specified, download the image and convert it to base64
          axios.get(field.src, { responseType: 'arraybuffer' })
            .then(response => {
              // Convert the image data to base64
              const imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
              templateInputs[0][field.name] = imageBase64;
            })
            .catch(error => {
              console.error('Error downloading image:', error);
            });
        } else {
          // For non-image fields, use the input value or fallback to template content
          templateInputs[0][field.name] = mergedInputs[field.name] || field.content || '';
        }
      });
    });

    // Generate initial PDF with PDFme
    const pdfmeResult = await generate({ 
      template, 
      inputs: templateInputs,
      plugins: {
        text,
        image,
        qrcode: barcodes.qrcode,
      }
    });

    // Load the generated PDF into pdf-lib to add metadata
    const pdfDoc = await PDFDocument.load(pdfmeResult.buffer);
    
    // Create a JSON string of all input values and set as subject
    const inputValuesJson = JSON.stringify(templateInputs[0]);
    pdfDoc.setSubject(inputValuesJson);
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');
    res.send(Buffer.from(modifiedPdfBytes));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
});
