// api/generate-invoice.js
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Configure chromium for Vercel
chromium.setGraphicsMode = false;

export default async function handler(req, res) {
  // Enable CORS for Airtable
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { clientName, amount, invoiceDate, services, companyName } = req.body;

    // Validate required fields
    if (!clientName || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: clientName and amount are required' 
      });
    }

    const invoiceNumber = `INV-${Date.now()}`;
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Professional Invoice HTML Template
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice ${invoiceNumber}</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  color: #333;
                  line-height: 1.6;
                  padding: 40px;
                  background: #fff;
              }
              
              .invoice-container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 60px;
                  border: 1px solid #e0e0e0;
              }
              
              .header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 50px;
                  padding-bottom: 30px;
                  border-bottom: 3px solid #2563eb;
              }
              
              .company-info {
                  flex: 1;
              }
              
              .company-name {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1e293b;
                  margin-bottom: 8px;
              }
              
              .company-details {
                  font-size: 13px;
                  color: #64748b;
                  line-height: 1.8;
              }
              
              .invoice-title {
                  text-align: right;
                  flex: 1;
              }
              
              .invoice-title h1 {
                  font-size: 48px;
                  font-weight: 700;
                  color: #2563eb;
                  margin-bottom: 10px;
                  letter-spacing: -1px;
              }
              
              .invoice-meta {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 30px;
                  margin-bottom: 40px;
              }
              
              .meta-section {
                  background: #f8fafc;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #2563eb;
              }
              
              .meta-label {
                  font-size: 11px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  color: #64748b;
                  font-weight: 600;
                  margin-bottom: 8px;
              }
              
              .meta-value {
                  font-size: 15px;
                  color: #1e293b;
                  font-weight: 500;
              }
              
              .bill-to {
                  margin-bottom: 40px;
                  padding: 25px;
                  background: #f8fafc;
                  border-radius: 8px;
              }
              
              .bill-to h3 {
                  font-size: 13px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  color: #64748b;
                  margin-bottom: 12px;
                  font-weight: 600;
              }
              
              .bill-to p {
                  font-size: 16px;
                  color: #1e293b;
                  font-weight: 500;
              }
              
              .services-table {
                  width: 100%;
                  margin-bottom: 40px;
                  border-collapse: collapse;
              }
              
              .services-table thead {
                  background: #1e293b;
                  color: white;
              }
              
              .services-table th {
                  padding: 15px;
                  text-align: left;
                  font-size: 12px;
                  text-transform: uppercase;
                  letter-spacing: 1px;
                  font-weight: 600;
              }
              
              .services-table td {
                  padding: 18px 15px;
                  border-bottom: 1px solid #e2e8f0;
                  font-size: 14px;
              }
              
              .services-table tbody tr:hover {
                  background: #f8fafc;
              }
              
              .total-section {
                  margin-top: 40px;
                  padding: 30px;
                  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                  border-radius: 12px;
                  color: white;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
              }
              
              .total-label {
                  font-size: 18px;
                  font-weight: 600;
                  letter-spacing: 1px;
                  text-transform: uppercase;
              }
              
              .total-amount {
                  font-size: 42px;
                  font-weight: 700;
                  letter-spacing: -1px;
              }
              
              .footer {
                  margin-top: 60px;
                  padding-top: 30px;
                  border-top: 1px solid #e2e8f0;
                  text-align: center;
              }
              
              .footer p {
                  font-size: 13px;
                  color: #64748b;
                  line-height: 1.8;
              }
              
              .footer strong {
                  color: #1e293b;
              }
              
              .payment-status {
                  display: inline-block;
                  background: #10b981;
                  color: white;
                  padding: 6px 16px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }
          </style>
      </head>
      <body>
          <div class="invoice-container">
              <div class="header">
                  <div class="company-info">
                      <div class="company-name">${companyName || 'Your Company'}</div>
                      <div class="company-details">
                          123 Business Street<br>
                          City, State 12345<br>
                          Phone: (555) 123-4567<br>
                          Email: info@company.com
                      </div>
                  </div>
                  <div class="invoice-title">
                      <h1>INVOICE</h1>
                      <span class="payment-status">PAID</span>
                  </div>
              </div>
              
              <div class="invoice-meta">
                  <div class="meta-section">
                      <div class="meta-label">Invoice Number</div>
                      <div class="meta-value">${invoiceNumber}</div>
                  </div>
                  <div class="meta-section">
                      <div class="meta-label">Invoice Date</div>
                      <div class="meta-value">${invoiceDate || today}</div>
                  </div>
              </div>
              
              <div class="bill-to">
                  <h3>Bill To</h3>
                  <p>${clientName}</p>
              </div>
              
              <table class="services-table">
                  <thead>
                      <tr>
                          <th style="width: 70%;">Description</th>
                          <th style="width: 30%; text-align: right;">Amount</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td>${services || 'Professional Services'}</td>
                          <td style="text-align: right; font-weight: 600;">$${parseFloat(amount).toFixed(2)}</td>
                      </tr>
                  </tbody>
              </table>
              
              <div class="total-section">
                  <div class="total-label">Total Amount</div>
                  <div class="total-amount">$${parseFloat(amount).toFixed(2)}</div>
              </div>
              
              <div class="footer">
                  <p>
                      <strong>Thank you for your business!</strong><br>
                      Payment has been received and processed.<br>
                      If you have any questions, please contact us at info@company.com
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;

    console.log('Launching browser with optimized settings...');

    // Launch Puppeteer with optimized Chromium settings for Vercel
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();
    
    // Set content with timeout
    await page.setContent(htmlContent, { 
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000 
    });

    console.log('Generating PDF...');

    // Generate PDF with high quality settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
      },
      timeout: 30000
    });

    await browser.close();
    browser = null;

    console.log('PDF generated successfully');

    // Convert PDF to base64
    const base64Pdf = pdfBuffer.toString('base64');
    
    // Return the PDF as base64 and data URL
    return res.status(200).json({
      success: true,
      invoiceNumber: invoiceNumber,
      pdf: base64Pdf,
      pdfDataUrl: `data:application/pdf;base64,${base64Pdf}`,
      message: 'Invoice generated successfully'
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    
    // Make sure browser is closed even if there's an error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate invoice',
      details: error.message 
    });
  }
}
