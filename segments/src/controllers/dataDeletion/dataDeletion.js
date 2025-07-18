const { executeAppSchemaQuery, executeGoldSchemaQuery } = require('../../database/database');
const { v4: uuidv4 } = require('uuid');

// Function to log API responses
const logApiResponse = async (request_id, source, customer_email, response_status, response_body) => {
  try {
    const log_id = uuidv4();
    
    const query = `
      INSERT INTO data_deletion_api_logs (
        log_id,
        request_id,
        source,
        customer_email,
        response_status,
        response_body,
        created_at
      )
      VALUES (
        '${log_id}',
        '${request_id}',
        '${source}',
        '${customer_email}',
        ${response_status},
        '${JSON.stringify(response_body).replace(/'/g, "''")}',
        CURRENT_TIMESTAMP()
      )
    `;

    await executeAppSchemaQuery(query);
    console.log(`API response logged for ${source} - ${customer_email}`);
    return true;
  } catch (error) {
    console.error('Error logging API response:', error);
    // Don't throw error here to avoid disrupting the main flow
    return false;
  }
};

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
    const requestIds = Array.isArray(req.body.request_ids) ? req.body.request_ids : [req.params.request_id];
    const admin_email = req.user.email; // Assuming user info is available from auth middleware
    
    if (!requestIds.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one Request ID is required'
      });
    }

    const results = [];
    const errors = [];

    // Process each request ID
    for (const request_id of requestIds) {
      try {
        // Check if the request exists and is in 'Pending' status
        const checkQuery = `
          SELECT * FROM data_deletion_requests
          WHERE request_id = '${request_id}' AND status = 'pending'
        `;

        const existingRequests = await executeAppSchemaQuery(checkQuery);
        
        if (!existingRequests || existingRequests.length === 0) {
          errors.push({
            request_id,
            message: 'Pending deletion request not found'
          });
          continue;
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
        const deletionSources = request.deletion_sources ? request.deletion_sources.split(',') : ['Shopify', 'Braze', 'CDP'];

        // Perform the actual data deletion operations
        try {
          // Process each selected source
          for (const source of deletionSources) {
            console.log(`Processing deletion for source: ${source}`);
            
            switch (source.trim()) {
              case 'Shopify':
                await deleteFromShopify(request.customer_email, request_id);
                console.log(`Deleted data for ${request.customer_email} from Shopify`);
                break;
              case 'Braze':
                await deleteFromBraze(request.customer_email, request_id);
                console.log(`Deleted data for ${request.customer_email} from Braze`);
                break;
              // case 'CDP':
                // await deleteFromDatabricks(request.customer_email, request_id);
                // console.log(`Deleted data for ${request.customer_email} from CDP`);
                // break;
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
          
          results.push({
            request_id,
            status: 'completed',
            processed_by_admin_email: admin_email,
            processed_at_timestamp
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
          errors.push({
            request_id,
            message: `Data deletion failed: ${error.message}`,
            status: 'failed'
          });
        }
      } catch (error) {
        errors.push({
          request_id,
          message: `Error processing request: ${error.message}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} requests successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      data: {
        successful: results,
        failed: errors
      }
    });
  } catch (error) {
    console.error('Error processing data deletion request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process data deletion request',
      error: error.message
    });
  }
};

// Reject a data deletion request
const rejectDeletionRequest = async (req, res) => {
  try {
    const requestIds = Array.isArray(req.body.request_ids) ? req.body.request_ids : [req.params.request_id];
    const { rejection_reason } = req.body;
    const admin_email = req.user.email;
    
    if (!requestIds.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one Request ID is required'
      });
    }

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const results = [];
    const errors = [];

    // Process each request ID
    for (const request_id of requestIds) {
      try {
        // Check if the request exists and is in 'Pending' status
        const checkQuery = `
          SELECT * FROM data_deletion_requests
          WHERE request_id = '${request_id}' AND status = 'pending'
        `;

        const existingRequests = await executeAppSchemaQuery(checkQuery);
        
        if (!existingRequests || existingRequests.length === 0) {
          errors.push({
            request_id,
            message: 'Pending deletion request not found'
          });
          continue;
        }

        const processed_at_timestamp = new Date().toISOString();

        // Update the request with rejection details
        const updateQuery = `
          UPDATE data_deletion_requests
          SET 
            status = 'rejected',
            processed_by_admin_email = '${admin_email}',
            processed_at_timestamp = '${processed_at_timestamp}',
            notes = CASE 
              WHEN notes IS NULL OR notes = '' THEN '${rejection_reason}'
              ELSE CONCAT(notes, ' | Rejection reason: ', '${rejection_reason}')
            END
          WHERE request_id = '${request_id}'
        `;

        await executeAppSchemaQuery(updateQuery);
        
        results.push({
          request_id,
          status: 'rejected',
          processed_by_admin_email: admin_email,
          processed_at_timestamp,
          rejection_reason
        });
      } catch (error) {
        errors.push({
          request_id,
          message: `Error rejecting request: ${error.message}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Rejected ${results.length} requests successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      data: {
        successful: results,
        failed: errors
      }
    });
  } catch (error) {
    console.error('Error rejecting data deletion request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject data deletion request',
      error: error.message
    });
  }
};

// Helper functions for data deletion from different systems

// Delete user data from Databricks
// async function deleteFromDatabricks(email, request_id) {
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
    
//     const data = await response.json();
    
//     // Log Databricks API response
//     await logApiResponse(request_id, 'Databricks', email, response.status, data);
    
//     if (!response.ok) {
//       throw new Error(`Databricks API returned ${response.status}`);
//     }
    
//     // For now, we'll simulate a successful API call
//     console.log(`Successfully deleted data for ${email} from Databricks`);
//     return true;
//   } catch (error) {
//     console.error(`Error deleting data from Databricks for ${email}:`, error);
//     // Log error response
//     await logApiResponse(request_id, 'Databricks-Error', email, 500, { error: error.message });
//     throw new Error(`Databricks deletion failed: ${error.message}`);
//   }
// }

// Delete user data from Shopify via API
async function deleteFromShopify(email, request_id) {
  try {
    console.log(`Deleting data for ${email} from Shopify...`);

     // Step 1: Get customer ID by email
     const customerQuery = {
      query: `
        query getCustomerByEmail($query: String!) {
          customers(first: 1, query: $query) {
            nodes {
              id
              defaultEmailAddress {
                emailAddress
              }
            }
          }
        }
      `,
      variables: {
        query: `email:${email}`
      }
    };

    const customerResponse = await fetch(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_SECRET}`).toString('base64')
      },
      body: JSON.stringify(customerQuery)
    });

    if (!customerResponse.ok) {
      throw new Error(`Shopify customer lookup API returned ${customerResponse.status}`);
    }

    const customerData = await customerResponse.json();
    
    // Log customer lookup response
    await logApiResponse(request_id, 'Shopify-CustomerLookup', email, customerResponse.status, customerData);
    
    if (customerData.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(customerData.errors)}`);
    }

    const customers = customerData.data.customers.nodes;
    if (!customers || customers.length === 0) {
      console.log(`No customer found with email ${email} in Shopify`);
      return true; // Consider this a success since there's nothing to delete
    }

    const customerId = customers[0].id;
    console.log(`Found customer ID: ${customerId} for email: ${email}`);


    // Step 2: Request data erasure using customer ID
    const erasureQuery = {
      query: `
        mutation customerRequestDataErasure($customerId: ID!) {
          customerRequestDataErasure(customerId: $customerId) {
            customerId
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        customerId: customerId
      }
    };

    const erasureResponse = await fetch(`https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_SECRET}`).toString('base64')
      },
      body: JSON.stringify(erasureQuery)
    });

    if (!erasureResponse.ok) {
      throw new Error(`Shopify data erasure API returned ${erasureResponse.status}`);
    }

    const erasureData = await erasureResponse.json();
    
    // Log data erasure response
    await logApiResponse(request_id, 'Shopify-DataErasure', email, erasureResponse.status, erasureData);
    
    if (erasureData.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(erasureData.errors)}`);
    }

    if (erasureData.data.customerRequestDataErasure.userErrors.length > 0) {
      throw new Error(`Shopify user errors: ${JSON.stringify(erasureData.data.customerRequestDataErasure.userErrors)}`);
    }

    console.log(`Successfully requested data erasure for ${email} from Shopify`);
    return true;
  } catch (error) {
    console.error(`Error deleting data from Shopify for ${email}:`, error);
    // Log error response
    await logApiResponse(request_id, 'Shopify-Error', email, 500, { error: error.message });
    throw new Error(`Shopify deletion failed: ${error.message}`);
  }
}

// Delete user data from Braze via API
async function deleteFromBraze(email, request_id) {
  try {
    console.log(`Deleting data for ${email} from Braze...`);
  
    const response = await fetch('https://rest.iad-01.braze.com/users/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BRAZE_API_KEY}`
      },
      body: JSON.stringify({
        email_addresses: [
          {
            email: email,
            prioritization: ["most_recently_updated"]
          }
        ]
      })
    });
    
    const data = await response.json();
    
    // Log Braze API response
    await logApiResponse(request_id, 'Braze', email, response.status, data);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Braze API returned ${response.status}: ${errorText}`);
    }
    
    // For now, we'll simulate a successful API call
    console.log(`Successfully deleted data for ${email} from Braze. Users deleted: ${data.deleted}`);

    return true;
  } catch (error) {
    console.error(`Error deleting data from Braze for ${email}:`, error);
    // Log error response
    await logApiResponse(request_id, 'Braze-Error', email, 500, { error: error.message });
    throw new Error(`Braze deletion failed: ${error.message}`);
  }
}

// Get API logs for a specific deletion request
const getDeletionRequestApiLogs = async (req, res) => {
  try {
    const { request_id } = req.params;
    
    if (!request_id) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required'
      });
    }

    // Get the API logs for the specified request ID
    const query = `
      SELECT * FROM data_deletion_api_logs
      WHERE request_id = '${request_id}'
      ORDER BY created_at DESC
    `;

    const result = await executeAppSchemaQuery(query);
    
    // Parse the response_body JSON strings if they exist
    const formattedResult = result.map(log => {
      if (log.response_body) {
        try {
          log.response_body = JSON.parse(log.response_body);
        } catch (e) {
          // If parsing fails, keep the original string
          console.log(`Failed to parse response_body for log ${log.log_id}: ${e.message}`);
        }
      }
      return log;
    });

    return res.status(200).json({
      success: true,
      data: formattedResult
    });
  } catch (error) {
    console.error('Error fetching API logs for deletion request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch API logs',
      error: error.message
    });
  }
};

module.exports = {
  createDeletionRequest,
  getAllDeletionRequests,
  getPendingDeletionRequests,
  processDeletionRequest,
  rejectDeletionRequest,
  getDeletionRequestApiLogs
}; 