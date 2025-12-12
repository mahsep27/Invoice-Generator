// api/generate-invoice.js
// Deploy this to Vercel

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📨 Received request from Airtable');
    
    const { recordId, tableId, baseId } = req.body;
    
    if (!recordId || !tableId || !baseId) {
      return res.status(400).json({ 
        error: 'Missing required fields: recordId, tableId, or baseId' 
      });
    }

    // Step 1: Fetch record data from Airtable
    console.log('🔍 Fetching record from Airtable...');
    const recordData = await fetchAirtableRecord(baseId, tableId, recordId);
    
    // Step 2: Send to Google Apps Script to generate PDF
    console.log('📄 Generating PDF via Apps Script...');
    const pdfBase64 = await generatePDFFromAppsScript(recordData);
    
    // Step 3: Upload PDF back to Airtable
    console.log('⬆️ Uploading PDF to Airtable...');
    const attachmentUrl = await uploadPDFToAirtable(
      baseId, 
      tableId, 
      recordId, 
      pdfBase64,
      recordData
    );
    
    console.log('✅ Success! PDF uploaded to Airtable');
    
    return res.status(200).json({
      success: true,
      message: 'Invoice generated and uploaded to Airtable',
      attachmentUrl
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========================================
// FETCH RECORD FROM AIRTABLE
// ========================================
async function fetchAirtableRecord(baseId, tableId, recordId) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  
  const response = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`,
    {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Airtable fetch failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.fields;
}

// ========================================
// GENERATE PDF VIA GOOGLE APPS SCRIPT
// ========================================
async function generatePDFFromAppsScript(recordData) {
  const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
  
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    redirect: 'follow', // Important: follow redirects
    body: JSON.stringify(recordData)
  });

  if (!response.ok) {
    throw new Error(`Apps Script failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success || !result.pdfBase64) {
    throw new Error('Apps Script did not return PDF');
  }

  return result.pdfBase64;
}

// ========================================
// UPLOAD PDF TO AIRTABLE
// ========================================
async function uploadPDFToAirtable(baseId, tableId, recordId, pdfBase64, recordData) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  
  const fileName = `Invoice_${recordData['Invoice Number']}_${recordData['Inquiry Name'].replace(/\s+/g, '_')}.pdf`;
  
  // Convert base64 to buffer
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  
  // Step 1: Upload to Airtable attachments
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, fileName);
  
  // Step 2: Update the record with the attachment
  const updateResponse = await fetch(
    `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          'Invoice PDF': [
            {
              filename: fileName,
              url: `data:application/pdf;base64,${pdfBase64}`
            }
          ]
        }
      })
    }
  );

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Failed to upload PDF to Airtable: ${errorText}`);
  }

  const result = await updateResponse.json();
  return result.fields['Invoice PDF'][0].url;
}
