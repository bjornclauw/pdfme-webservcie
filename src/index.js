const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');
const { generate } = require('@pdfme/generator');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 6439;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

    const pdf = await generate({ 
      template, 
      inputs: templateInputs
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=generated.pdf');
    res.send(Buffer.from(pdf.buffer));
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
}); 