const { executeAppSchemaQuery, executeGoldSchemaQuery } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

// Create a new data deletion request
const createDeletionRequest = async (req, res) => {
  try {
    const { customer_email, customer_request_timestamp, notes, deletion_sources } = req.body;

    // Validate required fields
    if (!customer_email) {
      return res.status(400).json({
        success: false,
        message: 'Customer email is required'
      });
    }

    if (!customer_request_timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Customer request timestamp is required'
      });
    }

    // Generate a unique request ID
    const request_id = uuidv4();
    
    // Set initial status to 'Pending'
    const status = 'pending';
    
    // Get current timestamp for entry_created_timestamp
    const entry_created_timestamp = new Date().toISOString();
    
    // Use default value for deletion_sources if not provided
    const sources = deletion_sources || '';

    // Insert the request into the database using string interpolation
    const query = `
      INSERT INTO data_deletion_requests (
        request_id,
        customer_email,
        status,
        notes,
        customer_request_timestamp,
        entry_created_timestamp,
        deletion_sources
      )
      VALUES (
        '${request_id}',
        '${customer_email}',
        '${status}',
        ${notes ? `'${notes}'` : 'NULL'},
        '${customer_request_timestamp}',
        '${entry_created_timestamp}',
        '${sources}'
      )
    `;

    await executeAppSchemaQuery(query);

    return res.status(201).json({
      success: true,
      message: 'Data deletion request created successfully',
      data: {
        request_id,
        customer_email,
        status,
        notes,
        customer_request_timestamp,
        entry_created_timestamp,
        deletion_sources: sources
      }
    });
  } catch (error) {
    console.error('Error creating data deletion request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create data deletion request',
      error: error.message
    });
  }
};

// Get all data deletion requests with pagination and status filtering
const getAllDeletionRequests = async (req, res) => {
  try {
    // Extract pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'all'; // New status filter parameter
    const offset = (page - 1) * limit;
    
    // Build WHERE clause based on status filter
    let whereClause = '';
    if (status && status.toLowerCase() !== 'all') {
      whereClause = `WHERE status = '${status}'`;
    }
    
    // Get the total count of records for pagination metadata
    const countQuery = `
      SELECT COUNT(*) as total_count 
      FROM data_deletion_requests
      ${whereClause}
    `;
    
    const countResult = await executeAppSchemaQuery(countQuery);
    const totalCount = countResult[0]?.total_count || 0;
    
    // Query data with pagination and filtering
    const query = `
      SELECT * FROM data_deletion_requests
      ${whereClause}
      ORDER BY entry_created_timestamp DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await executeAppSchemaQuery(query);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      data: result,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching data deletion requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch data deletion requests',
      error: error.message
    });
  }
};

// Get pending data deletion requests
const getPendingDeletionRequests = async (req, res) => {
  try {
    const query = `
      SELECT * FROM data_deletion_requests
      WHERE status = 'pending'
      ORDER BY entry_created_timestamp ASC
    `;

    const result = await executeAppSchemaQuery(query);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching pending data deletion requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pending data deletion requests',
      error: error.message
    });
  }
};

// Process a data deletion request (approve and execute deletion)
const processDeletionRequest = async (req, res) => {
  try {
    const { request_id } = req.params;
    const admin_email = req.user.email; // Assuming user info is available from auth middleware
    
    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // First, check if the request exists and is in 'Pending' status
    const checkQuery = `
      SELECT * FROM data_deletion_requests
      WHERE request_id = '${request_id}' AND status = 'pending'
    `;

    const existingRequests = await executeAppSchemaQuery(checkQuery);
    
    if (!existingRequests || existingRequests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Pending deletion request not found'
      });
    }

    const request = existingRequests[0];
    const processed_at_timestamp = new Date().toISOString();

    // Update the request with admin info and processing time
    const updateQuery = `
      UPDATE data_deletion_requests
      SET 
        processed_by_admin_email = '${admin_email}',
        processed_at_timestamp = '${processed_at_timestamp}'
      WHERE request_id = '${request_id}'
    `;

    await executeAppSchemaQuery(updateQuery);

    // Get deletion sources from the request
    const deletionSources = request.deletion_sources ? request.deletion_sources.split(',') : ['Shopify', 'Braze', 'CDR'];

    // Perform the actual data deletion operations
    try {
      // Process each selected source
      for (const source of deletionSources) {
        console.log(`Processing deletion for source: ${source}`);
        
        switch (source.trim()) {
          case 'Shopify':
            // await deleteFromShopify(request.customer_email);
            console.log(`Deleted data for ${request.customer_email} from Shopify`);
            break;
          case 'Braze':
            // await deleteFromBraze(request.customer_email);
            console.log(`Deleted data for ${request.customer_email} from Braze`);
            break;
          case 'CDR':
            // await deleteFromDatabricks(request.customer_email);
            console.log(`Deleted data for ${request.customer_email} from CDR`);
            break;
          default:
            console.log(`Unknown source: ${source}, skipping`);
        }
      }
      
      // If all deletions successful, update status to 'Completed'
      const completeQuery = `
        UPDATE data_deletion_requests
        SET status = 'completed'
        WHERE request_id = '${request_id}'
      `;
      
      await executeAppSchemaQuery(completeQuery);
      
      return res.status(200).json({
        success: true,
        message: 'Data deletion request processed successfully',
        data: {
          request_id,
          status: 'completed',
          processed_by_admin_email: admin_email,
          processed_at_timestamp
        }
      });
    } catch (error) {
      // If any deletion fails, update status to 'Failed'
      const failQuery = `
        UPDATE data_deletion_requests
        SET status = 'failed'
        WHERE request_id = '${request_id}'
      `;
      
      await executeAppSchemaQuery(failQuery);
      
      console.error('Error processing data deletion:', error);
      return res.status(500).json({
        success: false,
        message: 'Data deletion failed',
        error: error.message,
        data: {
          request_id,
          status: 'failed'
        }
      });
    }
  } catch (error) {
    console.error('Error processing data deletion request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process data deletion request',
      error: error.message
    });
  }
};




// Helper functions for data deletion from different systems

// Delete user data from Databricks
// async function deleteFromDatabricks(email) {
//  try {
//     console.log(`Deleting data for ${email} from Databricks...`);

//     const response = await fetch('https://databricks-api-endpoint', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${process.env.DATABRICKS_API_KEY}`
//       },
//       body: JSON.stringify({ email })
//     });
    
//     if (!response.ok) {
//       throw new Error(`Databricks API returned ${response.status}`);
//     }
    
//     const data = await response.json();
    
//     // For now, we'll simulate a successful API call
//     console.log(`Successfully deleted data for ${email} from Databricks`);
//     return true;
//   } catch (error) {
//     console.error(`Error deleting data from Databricks for ${email}:`, error);
//     throw new Error(`Databricks deletion failed: ${error.message}`);
//   }
// }

// // Delete user data from Shopify via API
// async function deleteFromShopify(email) {
//   try {
//     console.log(`Deleting data for ${email} from Shopify...`);

//     const response = await fetch('https://shopify-api-endpoint/customers/data-erasure', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${process.env.SHOPIFY_API_KEY}`
//       },
//       body: JSON.stringify({ email })
//     });
    
//     if (!response.ok) {
//       throw new Error(`Shopify API returned ${response.status}`);
//     }
    
//     const data = await response.json();
    
//     // For now, we'll simulate a successful API call
//     console.log(`Successfully deleted data for ${email} from Shopify`);
//     return true;
//   } catch (error) {
//     console.error(`Error deleting data from Shopify for ${email}:`, error);
//     throw new Error(`Shopify deletion failed: ${error.message}`);
//   }
// }

// // Delete user data from Braze via API
// async function deleteFromBraze(email) {
//   try {
//     console.log(`Deleting data for ${email} from Braze...`);
  
//     const response = await fetch('https://rest.iad-01.braze.com/users/delete', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${process.env.BRAZE_API_KEY}`
//       },
//       body: JSON.stringify({
//         external_ids: [],
//         user_aliases: [],
//         braze_ids: [],
//         email_addresses: [email]
//       })
//     });
    
//     if (!response.ok) {
//       throw new Error(`Braze API returned ${response.status}`);
//     }
    
//     const data = await response.json();
    
//     // For now, we'll simulate a successful API call
//     console.log(`Successfully deleted data for ${email} from Braze`);
//     return true;
//   } catch (error) {
//     console.error(`Error deleting data from Braze for ${email}:`, error);
//     throw new Error(`Braze deletion failed: ${error.message}`);
//   }
// }

module.exports = {
  createDeletionRequest,
  getAllDeletionRequests,
  getPendingDeletionRequests,
  processDeletionRequest
}; 