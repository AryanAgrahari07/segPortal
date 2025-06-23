const { executeQuery } = require('../../database/database.js');
require('dotenv').config();

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

/**
 * Parse filter group and build WHERE clause
 * @param {Object} filterGroup - Filter group with logic operator and filters
 * @returns {Object} Object with SQL WHERE clause and params array
 */
exports.buildFilterCondition = (filterGroup) => {
  if (!filterGroup || !filterGroup.filters || !filterGroup.filters.length) {
    return { sql: '', params: [] };
  }

  const logicOperator = (filterGroup.logic_operator || 'AND').toUpperCase();
  const conditions = [];
  const params = [];

  // Process each filter in the group
  filterGroup.filters.forEach(filter => {
    if (filter.type === 'condition') {
      // Handle basic filter condition
      let condition;
      switch (filter.operator) {
        case 'equals':
          condition = `${filter.column} = ${escapeSQLString(filter.value)}`;
          break;
        case 'notEquals':
          condition = `${filter.column} <> ${escapeSQLString(filter.value)}`;
          break;
        case 'contains':
          condition = `${filter.column} LIKE ${escapeSQLString(`%${filter.value}%`)}`;
          break;
        case 'startsWith':
          condition = `${filter.column} LIKE ${escapeSQLString(`${filter.value}%`)}`;
          break;
        case 'endsWith':
          condition = `${filter.column} LIKE ${escapeSQLString(`%${filter.value}`)}`;
          break;
        case 'greaterThan':
          condition = `${filter.column} > ${escapeSQLString(filter.value)}`;
          break;
        case 'greaterThanOrEqual':
          condition = `${filter.column} >= ${escapeSQLString(filter.value)}`;
          break;
        case 'lessThan':
          condition = `${filter.column} < ${escapeSQLString(filter.value)}`;
          break;
        case 'lessThanOrEqual':
          condition = `${filter.column} <= ${escapeSQLString(filter.value)}`;
          break;
        case 'in':
          if (Array.isArray(filter.value)) {
            const escapedValues = filter.value.map(val => escapeSQLString(val)).join(', ');
            condition = `${filter.column} IN (${escapedValues})`;
          } else {
            condition = '1=1'; // Default true condition if value is not an array
          }
          break;
        case 'between':
          if (Array.isArray(filter.value) && filter.value.length >= 2) {
            condition = `${filter.column} BETWEEN ${escapeSQLString(filter.value[0])} AND ${escapeSQLString(filter.value[1])}`;
          } else {
            condition = '1=1'; // Default true condition if value is not a proper array
          }
          break;
        case 'isNull':
          condition = `${filter.column} IS NULL`;
          break;
        case 'isNotNull':
          condition = `${filter.column} IS NOT NULL`;
          break;
        default:
          condition = '1=1'; // Default true condition for unsupported operators
      }
      conditions.push(condition);
    } else if (filter.type === 'group' && filter.group) {
      // Recursively process nested filter group
      const nestedCondition = buildFilterCondition(filter.group);
      if (nestedCondition.sql) {
        conditions.push(`(${nestedCondition.sql})`);
        params.push(...nestedCondition.params);
      }
    }
  });

  // Join all conditions with the logic operator
  if (conditions.length === 0) {
    return { sql: '', params: [] };
  }

  // Handle NOT condition for the group
  let sql = conditions.join(` ${logicOperator} `);
  if (filterGroup.not) {
    sql = `NOT (${sql})`;
  }

  return {
    sql,
    params
  };
};

/**
 * Get table data with pagination and filters
 */
exports.getTableData = async (req, res) => {
  try {
    // Get pagination parameters from query params or request body
    const page = parseInt(req.body.page || req.query.page) || 1;
    const pageSize = parseInt(req.body.pageSize || req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    
    // Get sorting parameters
    const sortColumn = req.query.sortColumn || req.body.sortColumn ;
    const sortOrder = (req.query.sortOrder || req.body.sortOrder || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    // Get table name
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }

    console.log("Request body for table data:", req.body);
    
    // Get filter data from request body
    const { filterGroups, groupConditions, customSql } = req.body;
    
    // First, check if the table has an email column
    let emailColumnExists = false;
    let emailColumnName = '';
    
    try {
      // Handle multi-part table names (catalog.schema.table)
      const parts = tableName.split('.');
      let quotedTableName;
      
      if (parts.length === 3) {
        // Format: catalog.schema.table
        quotedTableName = `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``;
      } else if (parts.length === 2) {
        // Format: schema.table
        quotedTableName = `\`${parts[0]}\`.\`${parts[1]}\``;
      } else {
        // Format: just table
        quotedTableName = `\`${tableName}\``;
      }
      
      // Check for columns that might contain email (looking for common email column names)
      const columnCheckQuery = `DESCRIBE TABLE ${quotedTableName}`;
      const columns = await executeQuery(columnCheckQuery);
      
      // Look for column names that likely contain email data
      const emailColumnPattern = /email|e_mail|mail|email_address/i;
      const emailColumn = columns.find(col => emailColumnPattern.test(col.col_name || col.name || ''));
      
      if (emailColumn) {
        emailColumnExists = true;
        emailColumnName = emailColumn.col_name || emailColumn.name;
        console.log(`Found email column: ${emailColumnName}`);
      }
    } catch (error) {
      console.error('Error checking for email column:', error);
      // Continue with the request even if we can't determine if there's an email column
    }
    
    // Check if custom SQL is provided
    if (customSql) {
      try {
        // Execute custom SQL with pagination
        // For direct SQL, we need to modify it to support pagination
        
        // Count total rows
        const countSql = `SELECT COUNT(*) AS total FROM (${customSql}) AS countQuery`;
        const countResult = await executeQuery(countSql);
        const total = countResult[0].total;
        
        // Count unique emails if email column exists
        let uniqueEmailCount = 0;
        if (emailColumnExists) {
          const uniqueEmailSql = `SELECT COUNT(DISTINCT ${emailColumnName}) AS unique_emails FROM (${customSql}) AS emailQuery`;
          try {
            const uniqueEmailResult = await executeQuery(uniqueEmailSql);
            uniqueEmailCount = uniqueEmailResult[0].unique_emails;
          } catch (emailError) {
            console.error('Error counting unique emails in custom SQL:', emailError);
            // Continue without unique email count
          }
        }
        
        // Apply pagination to the SQL
        const paginatedSql = `SELECT * FROM (${customSql}) AS dataQuery LIMIT ${pageSize} OFFSET ${offset}`;
        const data = await executeQuery(paginatedSql);
        
        // Calculate total pages
        const totalPages = Math.ceil(total / pageSize);
        
        return res.status(200).json({
          success: true,
          data: {
            rows: data,
            pagination: {
              total,
              page,
              pageSize,
              totalPages
            },
            uniqueEmails: emailColumnExists ? uniqueEmailCount : null
          }
        });
      } catch (error) {
        console.error('Error executing custom SQL:', error);
        return res.status(400).json({
          success: false,
          message: 'Error executing custom SQL',
          error: error.message
        });
      }
    }
    
    // Build the base SQL query
    let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
    let dataQuery = `SELECT * FROM ${tableName}`;
    let uniqueEmailQuery = emailColumnExists ? `SELECT COUNT(DISTINCT ${emailColumnName}) AS unique_emails FROM ${tableName}` : null;
    
    // Apply filters if provided
    if (filterGroups && Array.isArray(filterGroups) && filterGroups.length > 0) {
      const rootConditions = [];
      
      // Process each filter group at the root level
      for (const group of filterGroups) {
        const condition = this.buildFilterCondition(group);
        if (condition.sql) {
          rootConditions.push(`(${condition.sql})`);
        }
      }
      
      // Combine all root level groups with the specified conditions
      if (rootConditions.length > 0) {
        let whereClause = " WHERE ";
        
        for (let i = 0; i < rootConditions.length; i++) {
          whereClause += rootConditions[i];
          
          // Add the condition between this group and the next one if it's not the last group
          if (i < rootConditions.length - 1) {
            if (groupConditions && Array.isArray(groupConditions) && i < groupConditions.length) {
              const groupCondition = groupConditions[i]?.toUpperCase();
              
              // Handle different types of conditions
              if (groupCondition === 'AND') {
                whereClause += ` AND `;
              } else if (groupCondition === 'OR') {
                whereClause += ` OR `;
              } else if (groupCondition === 'NOT') {
                whereClause += ` AND NOT `;
              } else {
                // Default to AND if invalid
                whereClause += ` AND `;
              }
            } else {
              // Default to AND if no conditions specified
              whereClause += ` AND `;
            }
          }
        }
        
        countQuery += whereClause;
        dataQuery += whereClause;
        if (uniqueEmailQuery) {
          uniqueEmailQuery += whereClause;
        }
      }
    }
    
    if(sortColumn && sortOrder){
      // Apply sorting and pagination to data query
      dataQuery += ` ORDER BY ${sortColumn} ${sortOrder}`;
    }
    
    if(pageSize && page){
      dataQuery += ` LIMIT ${pageSize} OFFSET ${offset}`;
    }
    
    console.log('Executing count query:', countQuery);
    console.log('Executing data query:', dataQuery);
    if (uniqueEmailQuery) {
      console.log('Executing unique email query:', uniqueEmailQuery);
    }
    
    // Execute the count query first
    const countResult = await executeQuery(countQuery);
    const total = countResult[0].total;
    
    // Execute unique email count query if applicable
    let uniqueEmailCount = null;
    if (uniqueEmailQuery) {
      try {
        const uniqueEmailResult = await executeQuery(uniqueEmailQuery);
        uniqueEmailCount = uniqueEmailResult[0].unique_emails;
      } catch (emailError) {
        console.error('Error counting unique emails:', emailError);
        // Continue without unique email count
      }
    }
    
    // Execute the data query
    const data = await executeQuery(dataQuery);
    
    // Calculate total pages
    const totalPages = Math.ceil(total / pageSize);
    
    return res.status(200).json({
      success: true,
      data: {
        rows: data,
        pagination: {
          total,
          page,
          pageSize,
          totalPages
        },
        uniqueEmails: uniqueEmailCount
      }
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table data',
      error: error.message
    });
  }
};

/**
 * Get table data with applied segment (pre-configured filters)
 */
exports.getTableDataWithSegment = async (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    
    // Get table name and segment ID
    const { tableName, segmentId } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }
    
    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }
    
    // Get segment data
    const segmentQuery = `SELECT * FROM segments WHERE segment_id = ${escapeSQLString(segmentId)}`;
    const segmentResult = await executeQuery(segmentQuery);
    
    if (!segmentResult || segmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }
    
    const segment = segmentResult[0];
    
    // Get filter groups data with their conditions
    const filterGroupsQuery = `SELECT * FROM filter_groups WHERE segment_id = ${escapeSQLString(segmentId)} ORDER BY group_order`;
    const filterGroupsResult = await executeQuery(filterGroupsQuery);
    
    // Determine which SQL to use (custom or generated)
    let sql;
    if (segment.custom_sql) {
      // Use custom SQL if available
      sql = segment.custom_sql;
    } else if (segment.generated_sql) {
      // Use generated SQL if available
      sql = segment.generated_sql;
    } else {
      // Try to parse the segment config and generate SQL
      try {
        const segmentConfig = JSON.parse(segment.segment_config);
        
        // Build base queries
        let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
        let dataQuery = `SELECT * FROM ${tableName}`;
        
        // Apply filters from segment config
        if (segmentConfig.filterGroups && Array.isArray(segmentConfig.filterGroups)) {
          const rootConditions = [];
          
          // Process each filter group
          for (const group of segmentConfig.filterGroups) {
            const condition = this.buildFilterCondition(group);
            if (condition.sql) {
              rootConditions.push(`(${condition.sql})`);
            }
          }
          
          // Combine all root level groups with their respective conditions
          if (rootConditions.length > 0) {
            let whereClause = " WHERE ";
            
            for (let i = 0; i < rootConditions.length; i++) {
              whereClause += rootConditions[i];
              
              // Add the condition between this group and the next one if it's not the last group
              if (i < rootConditions.length - 1) {
                // Find the corresponding filter group from the database to get the group_condition
                const filterGroupDb = filterGroupsResult.find(fg => fg.id === segmentConfig.filterGroups[i].id);
                
                // Use the group_condition from the database if available, otherwise default to AND
                const groupCondition = filterGroupDb?.group_condition?.toUpperCase() || 'AND';
                
                // Handle different types of conditions
                if (groupCondition === 'AND') {
                  whereClause += ` AND `;
                } else if (groupCondition === 'OR') {
                  whereClause += ` OR `;
                } else if (groupCondition === 'NOT') {
                  whereClause += ` AND NOT `;
                } else {
                  // Default to AND if invalid
                  whereClause += ` AND `;
                }
              }
            }
            
            countQuery += whereClause;
            dataQuery += whereClause;
          }
        }
        
        // Apply sorting from segment config or default sorting
        const sortColumn = segmentConfig.sortColumn || 'id';
        const sortOrder = (segmentConfig.sortOrder || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        
        // Apply sorting and pagination to data query
        dataQuery += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ${pageSize} OFFSET ${offset}`;
        
        console.log('Executing segment query:', dataQuery);
        
        // Execute the count query first
        const countResult = await executeQuery(countQuery);
        const total = countResult[0].total;
        
        // Execute the data query
        const data = await executeQuery(dataQuery);
        
        // Calculate total pages
        const totalPages = Math.ceil(total / pageSize);
        
        // Update last executed timestamp
        await executeQuery(`
          UPDATE segments
          SET last_executed = CURRENT_TIMESTAMP(),
              updated_at = CURRENT_TIMESTAMP()
          WHERE segment_id = ${escapeSQLString(segmentId)}
        `);
        
        return res.status(200).json({
          success: true,
          data: {
            rows: data,
            segment: {
              segment_id: segment.segment_id,
              segment_name: segment.segment_name
            },
            pagination: {
              total,
              page,
              pageSize,
              totalPages
            }
          }
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid segment configuration',
          error: error.message
        });
      }
    }
    
    // If we have direct SQL (custom or generated), execute it with pagination
    try {
      // For direct SQL, we need to modify it to support pagination
      // This is a simplified approach and might need adjustments based on your SQL dialect
      
      // Count total rows
      const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS countQuery`;
      const countResult = await executeQuery(countSql);
      const total = countResult[0].total;
      
      // Apply pagination to the SQL
      const paginatedSql = `SELECT * FROM (${sql}) AS dataQuery ORDER BY id LIMIT ${pageSize} OFFSET ${offset}`;
      const data = await executeQuery(paginatedSql);
      
      // Calculate total pages
      const totalPages = Math.ceil(total / pageSize);
      
      // Update last executed timestamp
      await executeQuery(`
        UPDATE segments
        SET last_executed = CURRENT_TIMESTAMP(),
            updated_at = CURRENT_TIMESTAMP()
        WHERE segment_id = ${escapeSQLString(segmentId)}
      `);
      
      return res.status(200).json({
        success: true,
        data: {
          rows: data,
          segment: {
            segment_id: segment.segment_id,
            segment_name: segment.segment_name
          },
          pagination: {
            total,
            page,
            pageSize,
            totalPages
          }
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Error executing segment SQL',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error fetching table data with segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table data with segment',
      error: error.message
    });
  }
};

/**
 * Get table metadata (columns, data types, etc.)
 */
exports.getTableMetadata = async (req, res) => {
  try {
    console.log('Request params:', req.params);
    console.log('Request query:', req.query);
    
    // Try to get tableName from different sources
    let tableName = req.params.tableName || req.query.tableName;
    
    console.log('Table name:', tableName);
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }
    
    // Validate tableName to prevent SQL injection
    // Allow only alphanumeric characters, dots, and underscores for table names
    if (!tableName.match(/^[a-zA-Z0-9_.]+$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid table name format'
      });
    }
    
    // Handle multi-part table names (catalog.schema.table)
    const parts = tableName.split('.');
    let quotedTableName;
    
    if (parts.length === 3) {
      // Format: catalog.schema.table
      quotedTableName = `\`${parts[0]}\`.\`${parts[1]}\`.\`${parts[2]}\``;
    } else if (parts.length === 2) {
      // Format: schema.table
      quotedTableName = `\`${parts[0]}\`.\`${parts[1]}\``;
    } else {
      // Format: just table
      quotedTableName = `\`${tableName}\``;
    }
    
    // Query to get column information
    // This SQL is for Databricks - you may need to adjust for your specific database
    const query = `DESCRIBE TABLE ${quotedTableName}`;
    
    console.log('Executing query:', query);
    const columns = await executeQuery(query);
    
    return res.status(200).json({
      success: true,
      data: {
        tableName,
        columns
      }
    });
  } catch (error) {
    console.error('Error fetching table metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table metadata',
      error: error.message
    });
  }
};
