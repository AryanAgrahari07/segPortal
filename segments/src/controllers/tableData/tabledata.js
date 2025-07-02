const { executeGoldSchemaQuery, executeAppSchemaQuery, clearSchemaContext } = require('../../database/database.js');
const { getVisibleColumns, getVisibleColumnsForSegment } = require('../admin/column_visibility.js');
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
    const { filterGroups, groupConditions, customSql, segmentId } = req.body;
    
    // Clear schema context before proceeding to ensure we use the correct schema
    await clearSchemaContext();
    
    // Ensure segmentId is valid
    const validSegmentId = segmentId && segmentId !== 'null' && segmentId !== 'undefined' ? segmentId : undefined;
    
    // First, check if the table has an email column
    let emailColumnExists = false;
    let emailColumnName = '';
    let tableColumns = [];
    let visibleColumns = [];
    let columnsInFilters = new Set(); // Track columns used in filters
    
    // Extract column names from filter groups if they exist
    if (filterGroups && Array.isArray(filterGroups)) {
      filterGroups.forEach(group => {
        if (group.filters && Array.isArray(group.filters)) {
          group.filters.forEach(filter => {
            if (filter.type === 'condition' && filter.column) {
              columnsInFilters.add(filter.column);
            }
          });
        }
      });
    }
    
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
      
      // Get all columns from the table to avoid column mismatch errors
      const columnCheckQuery = `DESCRIBE TABLE ${quotedTableName}`;
      const columns = await executeGoldSchemaQuery(columnCheckQuery);
      
      // Store column names for later use
      tableColumns = columns.map(col => col.col_name || col.name || '');
      
      // Get visible columns based on column visibility configuration
      try {
        // If request includes segmentId, use getVisibleColumnsForSegment
        const segmentIdParam = req.query?.segmentId || req.body?.segmentId;
        if (segmentIdParam && segmentIdParam !== 'null' && segmentIdParam !== 'undefined') {
          visibleColumns = await getVisibleColumnsForSegment(tableName, segmentIdParam);
          console.log(`Visible columns for ${tableName} with segment ${segmentIdParam}:`, visibleColumns);
        } else if (validSegmentId) {
          visibleColumns = await getVisibleColumnsForSegment(tableName, validSegmentId);
          console.log(`Visible columns for ${tableName} with segment ${validSegmentId}:`, visibleColumns);
        } else {
          visibleColumns = await getVisibleColumns(tableName);
          console.log(`Visible columns for ${tableName}:`, visibleColumns);
        }
      } catch (visibilityError) {
        console.error('Error getting visible columns:', visibilityError);
        // If there's an error getting visible columns, show all columns
        visibleColumns = [...tableColumns];
      }
      
      // If no visibility configurations exist or all columns are visible by default,
      // all columns should be visible
      if (!visibleColumns || visibleColumns.length === 0) {
        visibleColumns = [...tableColumns];
      }
      
      // Add columns used in filters to visible columns if they are currently hidden
      // This ensures columns used in segment filters are visible regardless of their visibility setting
      if (columnsInFilters.size > 0) {
        const combinedVisibleColumns = new Set(visibleColumns);
        columnsInFilters.forEach(column => {
          combinedVisibleColumns.add(column);
        });
        visibleColumns = Array.from(combinedVisibleColumns);
      }
      
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
        const countResult = await executeGoldSchemaQuery(countSql);
        const total = countResult[0].total;
        
        // Count unique emails if email column exists
        let uniqueEmailCount = 0;
        if (emailColumnExists) {
          const uniqueEmailSql = `SELECT COUNT(DISTINCT ${emailColumnName}) AS unique_emails FROM (${customSql}) AS emailQuery`;
          try {
            const uniqueEmailResult = await executeGoldSchemaQuery(uniqueEmailSql);
            uniqueEmailCount = uniqueEmailResult[0].unique_emails;
          } catch (emailError) {
            console.error('Error counting unique emails in custom SQL:', emailError);
            // Continue without unique email count
          }
        }
        
        // Apply pagination to the SQL
        const paginatedSql = `SELECT * FROM (${customSql}) AS dataQuery LIMIT ${pageSize} OFFSET ${offset}`;
        const data = await executeGoldSchemaQuery(paginatedSql);
        
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
    
    // Use specific visible columns instead of '*' to avoid column mismatch errors and respect visibility settings
    const columnsToSelect = visibleColumns.length > 0 ? visibleColumns.map(col => `\`${col}\``).join(', ') : '*';
    
    // Build the base SQL query with visible columns
    let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
    let dataQuery = `SELECT ${columnsToSelect} FROM ${tableName}`;
    let uniqueEmailQuery = emailColumnExists && visibleColumns.includes(emailColumnName) ? 
      `SELECT COUNT(DISTINCT ${emailColumnName}) AS unique_emails FROM ${tableName}` : null;
    
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
    const countResult = await executeGoldSchemaQuery(countQuery);
    const total = countResult[0].total;
    
    // Execute unique email count query if applicable
    let uniqueEmailCount = null;
    if (uniqueEmailQuery) {
      try {
        const uniqueEmailResult = await executeGoldSchemaQuery(uniqueEmailQuery);
        uniqueEmailCount = uniqueEmailResult[0].unique_emails;
      } catch (emailError) {
        console.error('Error counting unique emails:', emailError);
        // Continue without unique email count
      }
    }
    
    // Execute the data query
    try {
      const data = await executeGoldSchemaQuery(dataQuery);
      
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
      console.error('Error executing data query:', error);
      
      // Fallback: If error occurs with all columns, try with a subset of safe columns
      if (visibleColumns.length > 0) {
        try {
          console.log('Attempting fallback query with limited columns...');
          
          // Get first 10 visible columns only to reduce chance of errors
          const safeColumns = visibleColumns.slice(0, 10).map(col => `\`${col}\``).join(', ');
          const fallbackQuery = `SELECT ${safeColumns} FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`;
          
          console.log('Executing fallback query:', fallbackQuery);
          const fallbackData = await executeGoldSchemaQuery(fallbackQuery);
          
          // Calculate total pages
          const totalPages = Math.ceil(total / pageSize);
          
          return res.status(200).json({
            success: true,
            data: {
              rows: fallbackData,
              pagination: {
                total,
                page,
                pageSize,
                totalPages
              },
              uniqueEmails: uniqueEmailCount,
              limited_columns: true
            }
          });
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          throw error; // Throw original error
        }
      } else {
        throw error;
      }
    }
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
    
    if (!segmentId || segmentId === 'null' || segmentId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }
    
    // Clear schema context before proceeding to ensure we use the correct schema
    await clearSchemaContext();
    
    // Ensure segmentId is valid
    const validSegmentId = segmentId;
    
    // Get table columns to avoid column mismatch errors
    let tableColumns = [];
    let visibleColumns = [];
    let columnsInFilters = new Set(); // Track columns used in filters
    
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
      
      // Get all columns from the table
      const columnCheckQuery = `DESCRIBE TABLE ${quotedTableName}`;
      const columns = await executeGoldSchemaQuery(columnCheckQuery);
      
      // Store column names for later use
      tableColumns = columns.map(col => col.col_name || col.name || '');
      
      // Get segment data to extract columns used in filters
      const segmentQuery = `SELECT * FROM segments WHERE segment_id = ${escapeSQLString(validSegmentId)}`;
      const segmentResult = await executeAppSchemaQuery(segmentQuery);
      
      if (!segmentResult || segmentResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Segment not found'
        });
      }
      
      // Get filter groups data with their conditions
      const filterGroupsQuery = `SELECT * FROM filter_groups WHERE segment_id = ${escapeSQLString(validSegmentId)} ORDER BY group_order`;
      const filterGroupsResult = await executeAppSchemaQuery(filterGroupsQuery);
      
      // Get all filters to extract columns
      if (filterGroupsResult && filterGroupsResult.length > 0) {
        for (const group of filterGroupsResult) {
          const filtersQuery = `SELECT * FROM filters WHERE filter_group_id = ${escapeSQLString(group.id)}`;
          const filtersResult = await executeAppSchemaQuery(filtersQuery);
          
          if (filtersResult && filtersResult.length > 0) {
            filtersResult.forEach(filter => {
              if (filter.column_name) {
                columnsInFilters.add(filter.column_name);
              }
            });
          }
        }
      }
      
      // Get visible columns based on column visibility configuration
      try {
        // Use getVisibleColumnsForSegment to include columns used in filters
        visibleColumns = await getVisibleColumnsForSegment(tableName, validSegmentId);
        console.log(`Visible columns for ${tableName} with segment ${validSegmentId}:`, visibleColumns);
      } catch (visibilityError) {
        console.error('Error getting visible columns:', visibilityError);
        // If there's an error getting visible columns, show all columns
        visibleColumns = [...tableColumns];
      }
      
      // If no visibility configurations exist or all columns are visible by default,
      if (!visibleColumns || visibleColumns.length === 0) {
        visibleColumns = [...tableColumns];
      }
      
      // Add columns used in filters to visible columns if they are currently hidden
      if (columnsInFilters.size > 0) {
        const combinedVisibleColumns = new Set(visibleColumns);
        columnsInFilters.forEach(column => {
          combinedVisibleColumns.add(column);
        });
        visibleColumns = Array.from(combinedVisibleColumns);
      }
    } catch (error) {
      console.error('Error checking table columns:', error);
    }
    
    // Use specific visible columns instead of '*' to avoid column mismatch errors and respect visibility settings
    const columnsToSelect = visibleColumns.length > 0 ? visibleColumns.map(col => `\`${col}\``).join(', ') : '*';
    
    // Get segment data
    const segmentQuery = `SELECT * FROM segments WHERE segment_id = ${escapeSQLString(segmentId)}`;
    const segmentResult = await executeAppSchemaQuery(segmentQuery);
    
    if (!segmentResult || segmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }
    
    const segment = segmentResult[0];
    
    // Get filter groups data with their conditions
    const filterGroupsQuery = `SELECT * FROM filter_groups WHERE segment_id = ${escapeSQLString(segmentId)} ORDER BY group_order`;
    const filterGroupsResult = await executeAppSchemaQuery(filterGroupsQuery);
    
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
        
        // Build base queries with specific columns
        let countQuery = `SELECT COUNT(*) AS total FROM ${tableName}`;
        let dataQuery = `SELECT ${columnsToSelect} FROM ${tableName}`;
        
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
        const countResult = await executeGoldSchemaQuery(countQuery);
        const total = countResult[0].total;
        
        // Execute the data query with error handling
        try {
          const data = await executeGoldSchemaQuery(dataQuery);
          
          // Calculate total pages
          const totalPages = Math.ceil(total / pageSize);
          
          // Update last executed timestamp
          await executeAppSchemaQuery(`
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
        } catch (dataError) {
          console.error('Error executing segment data query:', dataError);
          
          // Fallback: If error occurs with all columns, try with a subset of safe columns
          if (visibleColumns.length > 0) {
            console.log('Attempting fallback query with limited columns...');
            
            // Get first 10 visible columns only to reduce chance of errors
            const safeColumns = visibleColumns.slice(0, 10).map(col => `\`${col}\``).join(', ');
            const fallbackQuery = `SELECT ${safeColumns} FROM ${tableName}${whereClause ? whereClause : ''} LIMIT ${pageSize} OFFSET ${offset}`;
            
            console.log('Executing fallback query:', fallbackQuery);
            const fallbackData = await executeGoldSchemaQuery(fallbackQuery);
            
            // Calculate total pages
            const totalPages = Math.ceil(total / pageSize);
            
            // Update last executed timestamp
            await executeAppSchemaQuery(`
              UPDATE segments
              SET last_executed = CURRENT_TIMESTAMP(),
                  updated_at = CURRENT_TIMESTAMP()
              WHERE segment_id = ${escapeSQLString(segmentId)}
            `);
            
            return res.status(200).json({
              success: true,
              data: {
                rows: fallbackData,
                segment: {
                  segment_id: segment.segment_id,
                  segment_name: segment.segment_name
                },
                pagination: {
                  total,
                  page,
                  pageSize,
                  totalPages
                },
                limited_columns: true
              }
            });
          } else {
            throw dataError;
          }
        }
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
      const countResult = await executeGoldSchemaQuery(countSql);
      const total = countResult[0].total;
      
      // Apply pagination to the SQL
      // If the sql contains SELECT *, replace it with specific columns if available
      let paginatedSql = sql;
      if (tableColumns.length > 0 && /SELECT\s+\*/i.test(sql)) {
        const columnsStr = tableColumns.map(col => `\`${col}\``).join(', ');
        paginatedSql = sql.replace(/SELECT\s+\*/i, `SELECT ${columnsStr}`);
      }
      
      paginatedSql = `SELECT * FROM (${paginatedSql}) AS dataQuery ORDER BY id LIMIT ${pageSize} OFFSET ${offset}`;
      
      try {
        const data = await executeGoldSchemaQuery(paginatedSql);
        
        // Calculate total pages
        const totalPages = Math.ceil(total / pageSize);
        
        // Update last executed timestamp
        await executeAppSchemaQuery(`
          UPDATE segments
          SET last_executed = CURRENT_TIMESTAMP(),
              updated_at = CURRENT_TIMESTAMP()
          WHERE segment_id = ${escapeSQLString(validSegmentId)}
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
      } catch (paginatedError) {
        console.error('Error executing paginated segment SQL:', paginatedError);
        
        // Fallback: try with fewer columns
        if (tableColumns.length > 0) {
          console.log('Attempting fallback query with limited columns...');
          
          // Get first 10 columns only to reduce chance of errors
          const safeColumns = tableColumns.slice(0, 10).map(col => `\`${col}\``).join(', ');
          const fallbackSql = `SELECT ${safeColumns} FROM (${sql}) AS dataQuery LIMIT ${pageSize} OFFSET ${offset}`;
          
          console.log('Executing fallback SQL:', fallbackSql);
          const fallbackData = await executeGoldSchemaQuery(fallbackSql);
          
          // Calculate total pages
          const totalPages = Math.ceil(total / pageSize);
          
          // Update last executed timestamp
          await executeAppSchemaQuery(`
            UPDATE segments
            SET last_executed = CURRENT_TIMESTAMP(),
                updated_at = CURRENT_TIMESTAMP()
            WHERE segment_id = ${escapeSQLString(segmentId)}
          `);
          
          return res.status(200).json({
            success: true,
            data: {
              rows: fallbackData,
              segment: {
                segment_id: segment.segment_id,
                segment_name: segment.segment_name
              },
              pagination: {
                total,
                page,
                pageSize,
                totalPages
              },
              limited_columns: true
            }
          });
        } else {
          throw paginatedError;
        }
      }
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
    
    // Clear schema context before proceeding to ensure we use the correct schema
    await clearSchemaContext();
    
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
    
    // Try different approaches to get table metadata
    let allColumns = [];
    let visibleColumns = [];
    let error = null;

    // First attempt: Standard DESCRIBE TABLE query
    try {
      const query = `DESCRIBE TABLE ${quotedTableName}`;
      console.log('Executing query:', query);
      allColumns = await executeGoldSchemaQuery(query);
      const validSegmentId = req.query?.segmentId || req.body?.segmentId;
      // Get visible columns based on column visibility configuration
      try {
        // If request includes segmentId, use getVisibleColumnsForSegment
        const segmentIdParam = req.query?.segmentId || req.body?.segmentId;
        if (segmentIdParam && segmentIdParam !== 'null' && segmentIdParam !== 'undefined') {
          visibleColumns = await getVisibleColumnsForSegment(tableName, segmentIdParam);
          console.log(`Visible columns for ${tableName} with segment ${segmentIdParam} metadata:`, visibleColumns);
        } else if (validSegmentId) {
          visibleColumns = await getVisibleColumnsForSegment(tableName, validSegmentId);
          console.log(`Visible columns for ${tableName} with segment ${validSegmentId} metadata:`, visibleColumns);
        } else {
          visibleColumns = await getVisibleColumns(tableName);
          console.log(`Visible columns for ${tableName} metadata:`, visibleColumns);
        }
      } catch (visibilityError) {
        console.error('Error getting visible columns:', visibilityError);
        // If there's an error getting visible columns, show all columns
        visibleColumns = allColumns.map(col => col.col_name || col.name || '');
      }
      
      // If no visibility configurations exist or all columns are visible by default,
      // all columns should be visible
      if (!visibleColumns || visibleColumns.length === 0) {
        visibleColumns = allColumns.map(col => col.col_name || col.name || '');
      }
      
      // Filter columns based on visibility
      const columnNames = allColumns.map(col => col.col_name || col.name || '');
      const filteredColumns = allColumns.filter(col => {
        const colName = col.col_name || col.name || '';
        return visibleColumns.includes(colName);
      });
      
      // Use filtered columns instead of all columns
      allColumns = filteredColumns;
    } catch (err) {
      console.error('Error with DESCRIBE TABLE:', err);
      error = err;
      
      // Second attempt: Try with a sample query
      try {
        console.log('Attempting alternative metadata retrieval...');
        const sampleQuery = `SELECT * FROM ${quotedTableName} LIMIT 1`;
        const sampleData = await executeGoldSchemaQuery(sampleQuery);
        
        if (sampleData && sampleData.length > 0) {
          // Get all column names from sample data
          const columnNames = Object.keys(sampleData[0]);
          
          // Get visible columns based on column visibility configuration
          try {
            // If request includes segmentId, use getVisibleColumnsForSegment
            const segmentIdParam = req.query?.segmentId || req.body?.segmentId;
            if (segmentIdParam && segmentIdParam !== 'null' && segmentIdParam !== 'undefined') {
              visibleColumns = await getVisibleColumnsForSegment(tableName, segmentIdParam);
              console.log(`Visible columns for ${tableName} with segment ${segmentIdParam} from sample:`, visibleColumns);
            } else if (validSegmentId) {
              visibleColumns = await getVisibleColumnsForSegment(tableName, validSegmentId);
              console.log(`Visible columns for ${tableName} with segment ${validSegmentId} from sample:`, visibleColumns);
            } else {
              visibleColumns = await getVisibleColumns(tableName);
              console.log(`Visible columns for ${tableName} from sample:`, visibleColumns);
            }
          } catch (visibilityError) {
            console.error('Error getting visible columns:', visibilityError);
            // If there's an error getting visible columns, show all columns
            visibleColumns = columnNames;
          }
          
          // If no visibility configurations exist or all columns are visible by default,
          // all columns should be visible
          if (!visibleColumns || visibleColumns.length === 0) {
            visibleColumns = columnNames;
          }
          
          // Filter column names based on visibility
          const filteredColumnNames = columnNames.filter(colName => 
            visibleColumns.includes(colName)
          );
          
          // Create metadata from filtered columns
          allColumns = filteredColumnNames.map(column => ({
            col_name: column,
            data_type: typeof sampleData[0][column]
          }));
        }
      } catch (altErr) {
        console.error('Alternative method also failed:', altErr);
        // Continue with original error
      }
    }
    
    // If we have columns data, return it
    if (allColumns && allColumns.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          tableName,
          columns: allColumns
        }
      });
    }
    
    // If all attempts failed
    throw error || new Error('Failed to retrieve table metadata through all methods');
  } catch (error) {
    console.error('Error fetching table metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch table metadata',
      error: error.message
    });
  }
};

/**
 * Get unique values for a column with pagination and search
 */
exports.getUniqueColumnValues = async (req, res) => {
  try {
    // Get table name and column name
    const { tableName, columnName } = req.params;
    
    // Get pagination and search parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const segmentId = req.query.segmentId;
    
    // Validate inputs
    if (!tableName || !columnName) {
      return res.status(400).json({
        success: false,
        message: 'Table name and column name are required'
      });
    }

    // Additional validation for security
    const validColumnNameRegex = /^[a-zA-Z0-9_]+$/;
    if (!validColumnNameRegex.test(columnName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid column name format'
      });
    }
    
    // Clear schema context
    await clearSchemaContext();
    
    // Format table name for SQL query - safer method using parts
    const parts = tableName.split('.');
    let quotedTableName;
    
    if (parts.length === 3) {
      // Format: catalog.schema.table
      quotedTableName = `\`${parts[0].replace(/[^\w.-]/g, '')}\`.\`${parts[1].replace(/[^\w.-]/g, '')}\`.\`${parts[2].replace(/[^\w.-]/g, '')}\``;
    } else if (parts.length === 2) {
      // Format: schema.table
      quotedTableName = `\`${parts[0].replace(/[^\w.-]/g, '')}\`.\`${parts[1].replace(/[^\w.-]/g, '')}\``;
    } else {
      // Format: just table
      quotedTableName = `\`${tableName.replace(/[^\w.-]/g, '')}\``;
    }
    
    // Escape column name
    const escapedColumnName = `\`${columnName.replace(/[^\w.-]/g, '')}\``;
    
    // Calculate offset for pagination - ensure positive values
    const offset = Math.max(0, (page - 1) * limit);
    const safeLimit = Math.min(100, Math.max(1, limit)); // Limit between 1 and 100
    
    // Build the query
    let query;
    let countQuery;
    
    if (search && search.trim() !== '') {
      // Include search condition with parameterized query approach
      // Escape search pattern to prevent SQL injection
      const searchPattern = `%${search.replace(/'/g, "''").replace(/\\/g, "\\\\").replace(/_/g, "\\_").replace(/%/g, "\\%")}%`;
      
      // Fix: Specify VARCHAR length and use string conversion functions instead of CAST when needed
      query = `
        SELECT DISTINCT ${escapedColumnName} 
        FROM ${quotedTableName} 
        WHERE ${escapedColumnName} IS NOT NULL 
          AND LOWER(${escapedColumnName}) LIKE LOWER('${searchPattern}')
        ORDER BY ${escapedColumnName}
        LIMIT ${safeLimit} OFFSET ${offset}
      `;
      
      countQuery = `
        SELECT COUNT(DISTINCT ${escapedColumnName}) as total 
        FROM ${quotedTableName} 
        WHERE ${escapedColumnName} IS NOT NULL 
          AND LOWER(${escapedColumnName}) LIKE LOWER('${searchPattern}')
      `;
    } else {
      // Without search condition
      query = `
        SELECT DISTINCT ${escapedColumnName} 
        FROM ${quotedTableName} 
        WHERE ${escapedColumnName} IS NOT NULL 
        ORDER BY ${escapedColumnName}
        LIMIT ${safeLimit} OFFSET ${offset}
      `;
      
      countQuery = `
        SELECT COUNT(DISTINCT ${escapedColumnName}) as total 
        FROM ${quotedTableName} 
        WHERE ${escapedColumnName} IS NOT NULL
      `;
    }
    
    // Execute queries with added try/catch blocks for each query
    let uniqueValues;
    let countResult;
    
    try {
      uniqueValues = await executeGoldSchemaQuery(query);
    } catch (queryError) {
      console.error('Error executing unique values query:', queryError);
      
      // Fallback query without CAST if the first one fails
      try {
        // Try a simpler query without search if there was an error
        if (search && search.trim() !== '') {
          const fallbackQuery = `
            SELECT DISTINCT ${escapedColumnName} 
            FROM ${quotedTableName} 
            WHERE ${escapedColumnName} IS NOT NULL 
            ORDER BY ${escapedColumnName}
            LIMIT ${safeLimit} OFFSET ${offset}
          `;
          uniqueValues = await executeGoldSchemaQuery(fallbackQuery);
        } else {
          throw queryError; // Re-throw if it wasn't a search-related issue
        }
      } catch (fallbackError) {
        return res.status(500).json({
          success: false,
          message: 'Error fetching unique values',
          error: queryError.message
        });
      }
    }
    
    try {
      countResult = await executeGoldSchemaQuery(countQuery);
    } catch (countError) {
      console.error('Error executing count query:', countError);
      // Continue with an estimated count or zero if count query fails
      countResult = [{ total: uniqueValues.length }];
    }
    
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit);
    
    // Extract just the values from the result
    const values = uniqueValues.map(row => {
      const value = row[columnName] !== undefined ? String(row[columnName]) : null;
      return value;
    }).filter(value => value !== null);
    
    // Return the results
    return res.status(200).json({
      success: true,
      data: values,
      pagination: {
        page,
        limit: safeLimit,
        total,
        totalPages
      }
    });
    
  } catch (error) {
    console.error('Error fetching unique column values:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unique column values',
      error: error.message
    });
  }
};
