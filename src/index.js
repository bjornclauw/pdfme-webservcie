const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');
const { generate } = require('@pdfme/generator');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const multer = require('multer');

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
 *     summary: Generate PDF from PDFme template and overide with input values
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
    const { schemas, basePdf, inputs = {} } = req.body;

    if (!basePdf || !schemas) {
      return res.status(400).json({ 
        error: 'Template schema with basePdf and schemas is required' 
      });
    }

    // Create the template object in the format expected by pdfme
    const template = {
      basePdf,
      schemas
    };

    // Merge query parameters with body inputs (query params take precedence)
    const mergedInputs = {
      ...inputs,
      ...req.query
    };

    // Extract default values from schema and merge with any provided input values
    const templateInputs = schemas.map(page => {
      const pageData = {};
      page.forEach(field => {
        // Use query param or body input if provided, otherwise use default content
        pageData[field.name] = mergedInputs[field.name] || field.content || '';
      });
      return pageData;
    });

    // Generate initial PDF with PDFme
    const pdfmeResult = await generate({ 
      template, 
      inputs: templateInputs
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

/**
 * @swagger
 * /protokoll-pdf:
 *   post:
 *     summary: Generate a simple PDF with provided text content
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             description: The text content to be included in the PDF
 *           example: "This is a sample text that will be rendered in the PDF."
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
app.post('/protokoll-pdf', async (req, res) => {
  try {
    const text = req.body;  // body is now the raw text

    if (!text) {
      return res.status(400).json({ 
        error: 'Text content is required in the request body' 
      });
    }

    // Create a simple template for text content
    const template = {
      basePdf: BLANK_PDF,
      schemas: [
        [
          {
            type: 'text',
            position: { x: 15, y: 20 },
            width: 180,
            height: 260,
            name: 'content',
            fontName: 'Helvetica',
            fontColor: '#000000',
            alignment: 'left',
            lineHeight: 1.2,
            characterSpacing: 0,
            opacity: 1,
            rotate: 0,
            padding: 10,
            verticalAlignment: 'top',
            //backgroundColor: '#F5F5F5',
            autoFit: true,
            fontSize: 10,
            maxFontSize: 11,
            minFontSize: 6,
            wrapText: true
          }
        ]
      ]
    };
    

    // Process the text to ensure proper line breaks
    const processedText = text
      .split(/\r?\n/)  // Split into lines
      .map(line => line.trim())  // Trim each line
      .join('\n');  // Rejoin with newlines

    const inputs = [
      {
        content: processedText
      }
    ];

    // Generate initial PDF with PDFme
    const pdfmeResult = await generate({ 
      template, 
      inputs
    });

    // Load the generated PDF into pdf-lib
    const pdfDoc = await PDFDocument.load(pdfmeResult.buffer);
    
    // Set the subject metadata without length limitation
    pdfDoc.setSubject(processedText);
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=protokoll.pdf');
    res.send(Buffer.from(modifiedPdfBytes));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

/**
 * @swagger
 * /extract-metadata:
 *   post:
 *     summary: Extract metadata from an uploaded PDF file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: The PDF file to extract metadata from
 *     responses:
 *       200:
 *         description: PDF metadata
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid input or no PDF file provided
 *       413:
 *         description: PDF file too large (max 10MB)
 *       500:
 *         description: Server error
 */
app.post('/extract-metadata', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No PDF file provided. Please upload a PDF file with field name "pdf".' 
      });
    }

    try {
      // Load the PDF document
      const pdfDoc = await PDFDocument.load(req.file.buffer);
      
      // Get only the subject metadata
      const subject = pdfDoc.getSubject();
      
      // Return just the subject as plain text
      res.setHeader('Content-Type', 'text/plain');
      res.send(subject || '');
      
    } catch (pdfError) {
      console.error('PDF parsing error:', pdfError);
      res.status(400).json({ 
        error: 'Failed to parse PDF file',
        details: pdfError.message 
      });
    }
  } catch (error) {
    console.error('PDF metadata extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract PDF metadata',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
}); 