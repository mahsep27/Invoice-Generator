// ========================================
// VERCEL API ENDPOINT
// ========================================
// File: /api/generate-invoice.js
// Handles: Airtable → Apps Script → Airtable flow

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  console.log('==========================================');
  console.log('📨 RECEIVED REQUEST FROM AIRTABLE');
  console.log('==========================================');
  
  try {
    // Get configuration from environment variables
    const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Invoices';

    // Validate environment variables
    if (!GOOGLE_APPS_SCRIPT_URL) {
      throw new Error('GOOGLE_APPS_SCRIPT_URL environment variable is not set');
    }
    if (!AIRTABLE_API_KEY) {
      throw new Error('AIRTABLE_API_KEY environment variable is not set');
    }
    if (!AIRTABLE_BASE_ID) {
      throw new Error('AIRTABLE_BASE_ID environment variable is not set');
    }

    const invoiceData = req.body;
    const recordId = invoiceData.recordId;

    console.log('📦 Invoice Data:', JSON.stringify(invoiceData, null, 2));

    if (!recordId) {
      throw new Error('Record ID is required in the request body');
    }

    console.log('📤 STEP 1: Forwarding to Google Apps Script...');
    console.log('   URL:', GOOGLE_APPS_SCRIPT_URL);
    
    // STEP 1: Send data to Google Apps Script
    const appsScriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData)
    });

    if (!appsScriptResponse.ok) {
      const errorText = await appsScriptResponse.text();
      throw new Error(`Apps Script request failed: ${appsScriptResponse.status} - ${errorText}`);
    }

    const appsScriptResult = await appsScriptResponse.json();

    // ✅ FIX: Log the full response for debugging
    console.log('📋 Apps Script Response:', JSON.stringify(appsScriptResult, null, 2));

    // ✅ FIX: Check success first
    if (!appsScriptResult.success) {
      throw new Error(`Apps Script Error: ${appsScriptResult.error || 'Unknown error from Apps Script'}`);
    }

    // ✅ FIX: Validate pdfBase64 exists before accessing .length
    if (!appsScriptResult.pdfBase64) {
      throw new Error('Apps Script did not return PDF data. Response fields: ' + Object.keys(appsScriptResult).join(', '));
    }

    if (!appsScriptResult.fileName) {
      throw new Error('Apps Script did not return fileName');
    }

    console.log('✅ PDF Generated Successfully');
    console.log('   File Name:', appsScriptResult.fileName);
    console.log('   PDF Size:', appsScriptResult.pdfBase64.length, 'characters');

    console.log('📤 STEP 2: Uploading PDF to Airtable...');
    console.log('   Base ID:', AIRTABLE_BASE_ID);
    console.log('   Table:', AIRTABLE_TABLE_NAME);
    console.log('   Record ID:', recordId);

    // STEP 2: Upload PDF to Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}/${recordId}`;
    
    const airtableUploadResponse = await fetch(airtableUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Invoice PDF': [
            {
              filename: appsScriptResult.fileName,
              url: `data:application/pdf;base64,${appsScriptResult.pdfBase64}`
            }
          ]
        }
      })
    });

    if (!airtableUploadResponse.ok) {
      const errorText = await airtableUploadResponse.text();
      console.error('❌ Airtable Error Response:', errorText);
      throw new Error(`Airtable upload failed: ${airtableUploadResponse.status} - ${errorText}`);
    }

    const airtableResult = await airtableUploadResponse.json();
    
    console.log('✅ PDF UPLOADED TO AIRTABLE SUCCESSFULLY!');
    console.log('==========================================');

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Invoice generated and uploaded to Airtable successfully',
      fileName: appsScriptResult.fileName,
      recordId: recordId,
      airtableRecordId: airtableResult.id
    });

  } catch (error) {
    console.error('==========================================');
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('==========================================');
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
