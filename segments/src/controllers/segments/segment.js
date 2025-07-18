const { executeAppSchemaQuery } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');
const { calculateDateRangeFromPreset, formatDateForSQL, normalizeDatePreset, generateSqlIntervalForPreset } = require('../../utils/dateUtils.js');
require('dotenv').config();

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

// Helper function to validate segment data
const validateSegmentData = (data) => {
  if (!data.segment_name || typeof data.segment_name !== 'string') {
    throw new Error('Invalid segment name');
  }
  if (!data.created_by || typeof data.created_by !== 'string') {
    throw new Error('Invalid creator ID');
  }
  if (!data.segment_config || typeof data.segment_config !== 'object') {
    throw new Error('Invalid segment configuration');
  }
};

// Get all segments - simple endpoint that returns all segments
exports.getAllSegments = async (req, res) => {
  try {
    const query = `
      SELECT * FROM segments
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;

    const results = await executeAppSchemaQuery(query);

    // Parse JSON strings back to objects
    const segments = results.map(segment => {
      try {
        return {
          ...segment,
          segment_config: segment.segment_config ? JSON.parse(segment.segment_config) : {}
        };
      } catch (err) {
        console.warn(`Error parsing segment_config for segment ${segment.segment_id}:`, err);
        return {
          ...segment,
          segment_config: {}
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: segments
    });
  } catch (error) {
    console.error('Error fetching all segments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch segments',
      error: error.message
    });
  }
};

// Get only the segment summary data needed for dashboard display
exports.getSegmentsSummary = async (req, res) => {
  try {
    const query = `
      SELECT 
        segment_id, 
        segment_name, 
        description, 
        created_by, 
        status, 
        created_at, 
        last_executed
      FROM segments
      WHERE is_active = TRUE
      ORDER BY created_at DESC
    `;

    const results = await executeAppSchemaQuery(query);

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching segments summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch segments summary',
      error: error.message
    });
  }
};

exports.createSegment = async (req, res) => {
  try {
    const segmentData = req.body;

    // Validate input data
    validateSegmentData(segmentData);

    const segmentId = uuidv4();
    const segmentConfig = JSON.stringify(segmentData.segment_config);

    // Process filter groups to generate dynamic SQL expressions for date presets
    if (segmentData.filter_groups && Array.isArray(segmentData.filter_groups)) {
      const datePresetFilters = [];
      
      // Find all date preset filters
      segmentData.filter_groups.forEach(group => {
        if (group.filters && Array.isArray(group.filters)) {
          group.filters.forEach(filter => {
            if (filter.date_preset || 
                (filter.operator && 
                 (filter.operator.startsWith('LAST_') || filter.operator.startsWith('THIS_')))) {
              
              let datePreset = filter.date_preset;
              
              // If date_preset is not explicitly set but operator looks like a date preset
              if (!datePreset && filter.operator) {
                datePreset = normalizeDatePreset(filter.operator.toLowerCase());
              }
              
              if (datePreset) {
                const columnName = filter.column_name || filter.column;
                const normalizedPreset = normalizeDatePreset(datePreset);
                
                // Generate SQL interval expression
                const sqlIntervalExpression = generateSqlIntervalForPreset(normalizedPreset, columnName);
                
                if (sqlIntervalExpression) {
                  datePresetFilters.push({
                    column: columnName,
                    preset: normalizedPreset,
                    sqlExpression: sqlIntervalExpression
                  });
                }
              }
            }
          });
        }
      });
      
      // Update custom SQL with dynamic date expressions if it exists
      if (segmentData.custom_sql && datePresetFilters.length > 0) {
        let updatedSql = segmentData.custom_sql;
        
        datePresetFilters.forEach(datePresetFilter => {
          const columnName = datePresetFilter.column;
          const sqlExpression = datePresetFilter.sqlExpression;
          
          // Pattern for: column BETWEEN 'date1' AND 'date2'
          const pattern = new RegExp(`(${columnName}\\s+BETWEEN\\s+['"]?[^'"\\s]+['"]?\\s+AND\\s+['"]?[^'"\\s]+['"]?)`, 'gi');
          
          if (pattern.test(updatedSql)) {
            // Reset the pattern's lastIndex
            pattern.lastIndex = 0;
            // Replace the matched pattern with the SQL interval expression
            updatedSql = updatedSql.replace(pattern, sqlExpression);
          }
        });
        
        // Update the custom_sql with the dynamic expressions
        segmentData.custom_sql = updatedSql;
      }
      
      // Update generated_sql with dynamic date expressions if it exists
      if (segmentData.generated_sql && datePresetFilters.length > 0) {
        let updatedSql = segmentData.generated_sql;
        
        datePresetFilters.forEach(datePresetFilter => {
          const columnName = datePresetFilter.column;
          const sqlExpression = datePresetFilter.sqlExpression;
          
          // Pattern for: column BETWEEN 'date1' AND 'date2'
          const pattern = new RegExp(`(${columnName}\\s+BETWEEN\\s+['"]?[^'"\\s]+['"]?\\s+AND\\s+['"]?[^'"\\s]+['"]?)`, 'gi');
          
          if (pattern.test(updatedSql)) {
            // Reset the pattern's lastIndex
            pattern.lastIndex = 0;
            // Replace the matched pattern with the SQL interval expression
            updatedSql = updatedSql.replace(pattern, sqlExpression);
          }
        });
        
        // Update the generated_sql with the dynamic expressions
        segmentData.generated_sql = updatedSql;
      }
      
      // If no custom_sql but we have filter groups, generate a new SQL with dynamic expressions
      if (!segmentData.custom_sql && !segmentData.generated_sql && datePresetFilters.length > 0) {
        // Generate SQL from filter groups
        let whereClause = "";
        const enabledGroups = segmentData.filter_groups.filter(group => group.isEnabled !== false);
        
        const groupClauses = enabledGroups.map(group => {
          if (!group.filters || group.filters.length === 0) return "";
          
          const filterClauses = group.filters.map(filter => {
            let clause = "";
            
            // Check if this is a date filter with a preset
            const hasDatePreset = !!filter.date_preset || 
                (filter.operator && 
                 (filter.operator.startsWith('LAST_') || filter.operator.startsWith('THIS_')));
                 
            if (hasDatePreset) {
              // Find matching date preset SQL expression
              const datePresetSql = datePresetFilters.find(
                dps => dps.column === (filter.column_name || filter.column)
              );
              
              if (datePresetSql) {
                // Use the SQL interval expression
                clause = datePresetSql.sqlExpression;
              } else {
                // Fall back to using the dynamically calculated dates if available
                if (filter.value && filter.value2) {
                  clause = `${filter.column_name || filter.column} BETWEEN '${filter.value}' AND '${filter.value2}'`;
                }
              }
            } else {
              // Handle regular operators based on frontend operator format
              const columnName = filter.column_name || filter.column;
              const operator = filter.filter_operator || filter.operator;
              const value = filter.filter_value || filter.value;
              const value2 = filter.filter_value_2 || filter.value2;
              
              switch (operator) {
                case "=":
                  clause = `${columnName} = '${value}'`;
                  break;
                case "!=":
                  clause = `${columnName} <> '${value}'`;
                  break;
                case ">":
                  clause = `${columnName} > '${value}'`;
                  break;
                case ">=":
                  clause = `${columnName} >= '${value}'`;
                  break;
                case "<":
                  clause = `${columnName} < '${value}'`;
                  break;
                case "<=":
                  clause = `${columnName} <= '${value}'`;
                  break;
                case "BETWEEN":
                  if (value && secondValue) {
                    clause = `${columnName} BETWEEN '${value}' AND '${secondValue}'`;
                  } else if (value) {
                    // Handle case where only first value is provided
                    clause = `${columnName} >= '${value}'`;
                  }
                  break;
                case "NOT_BETWEEN":
                  if (value && secondValue) {
                    clause = `${columnName} NOT BETWEEN '${value}' AND '${secondValue}'`;
                  } else if (value) {
                    // Handle case where only first value is provided
                    clause = `${columnName} < '${value}'`;
                  }
                  break;
                case "LIKE":
                  clause = `${columnName} LIKE '%${value}%'`;
                  break;
                case "NOT LIKE":
                  clause = `${columnName} NOT LIKE '%${value}%'`;
                  break;
                case "STARTS_WITH":
                  clause = `${columnName} LIKE '${value}%'`;
                  break;
                case "NOT_STARTS_WITH":
                  clause = `${columnName} NOT LIKE '${value}%'`;
                  break;
                case "ENDS_WITH":
                  clause = `${columnName} LIKE '%${value}'`;
                  break;
                case "NOT_ENDS_WITH":
                  clause = `${columnName} NOT LIKE '%${value}'`;
                  break;
                case "IN":
                  if (Array.isArray(value)) {
                    const inValues = value.map(v => `'${v}'`).join(", ");
                    clause = `${columnName} IN (${inValues})`;
                  } else if (typeof value === 'string') {
                    const inValues = value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${columnName} IN (${inValues})`;
                  }
                  break;
                case "NOT_IN":
                  if (Array.isArray(value)) {
                    const notInValues = value.map(v => `'${v}'`).join(", ");
                    clause = `${columnName} NOT IN (${notInValues})`;
                  } else if (typeof value === 'string') {
                    const notInValues = value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${columnName} NOT IN (${notInValues})`;
                  }
                  break;
                case "IS NULL":
                  clause = `${columnName} IS NULL`;
                  break;
                case "IS NOT NULL":
                  clause = `${columnName} IS NOT NULL`;
                  break;
              }
            }
            
            return clause;
          }).filter(Boolean); // Remove empty clauses
          
          if (filterClauses.length === 0) return "";
          
          // Handle NOT condition for the group
          const groupCondition = group.group_condition || group.condition || 'AND';
          const isNotCondition = group.not === true;
          
          if (isNotCondition) {
            return `NOT (${filterClauses.join(" AND ")})`;
          }
          
          return `(${filterClauses.join(` ${groupCondition} `)})`;
        }).filter(Boolean); // Remove empty group clauses
        
        if (groupClauses.length > 0) {
          // Use between-group conditions if available
          if (groupClauses.length > 1 && segmentData.groupConditions && segmentData.groupConditions.length > 0) {
            let finalClause = groupClauses[0];
            
            for (let i = 1; i < groupClauses.length; i++) {
              const condition = i - 1 < segmentData.groupConditions.length 
                ? segmentData.groupConditions[i - 1] 
                : "AND";
              finalClause += ` ${condition} ${groupClauses[i]}`;
            }
            
            whereClause = ` WHERE ${finalClause}`;
          } else {
            whereClause = ` WHERE ${groupClauses.join(" AND ")}`;
          }
        }
        
        // Get the table name from segment_config or table_id
        const tableName = segmentData.segment_config?.target_table || segmentData.table_id;
        
        // Generate the complete SQL with dynamic expressions
        segmentData.generated_sql = `SELECT * FROM ${tableName}${whereClause} LIMIT 1000`;
        console.log("Generated SQL with dynamic expressions:", segmentData.generated_sql);
      }
    }

    const query = `
      INSERT INTO segments (
        segment_id,
        table_id,
        segment_name,
        description,
        created_by,
        start_time,
        end_time,
        status,
        segment_config,
        generated_sql,
        custom_sql,
        is_template,
        is_saved_table
      )
      VALUES (
        ${escapeSQLString(segmentId)},
        ${segmentData.table_id ? escapeSQLString(segmentData.table_id) : 'NULL'},
        ${escapeSQLString(segmentData.segment_name)},
        ${segmentData.description ? escapeSQLString(segmentData.description) : 'NULL'},
        ${escapeSQLString(segmentData.created_by)},
        ${segmentData.start_time ? escapeSQLString(segmentData.start_time) : 'NULL'},
        ${segmentData.end_time ? escapeSQLString(segmentData.end_time) : 'NULL'},
        ${segmentData.status ? escapeSQLString(segmentData.status) : "'pending'"},
        ${escapeSQLString(segmentConfig)},
        ${segmentData.generated_sql ? escapeSQLString(segmentData.generated_sql) : 'NULL'},
        ${segmentData.custom_sql ? escapeSQLString(segmentData.custom_sql) : 'NULL'},
        ${segmentData.is_template || false},
        ${segmentData.is_saved_table || false}
      )
    `;

    await executeAppSchemaQuery(query);

    // Process filter groups and filters if they exist
    if (segmentData.filter_groups && Array.isArray(segmentData.filter_groups) && segmentData.filter_groups.length > 0) {
      console.log("Creating filter groups for segment:", segmentId);
      console.log("Filter groups data:", JSON.stringify(segmentData.filter_groups));
      
      for (let i = 0; i < segmentData.filter_groups.length; i++) {
        const group = segmentData.filter_groups[i];
        const groupId = uuidv4();
        
        // Get the group condition for this group (applies to the relationship with the next group)
        let groupCondition = group.group_condition || group.condition || 'AND';
        
        // Insert filter group
        const groupQuery = `
          INSERT INTO filter_groups (
            id,
            segment_id,
            group_name,
            group_order,
            group_condition,
            between_group_condition,
            description
          )
          VALUES (
            ${escapeSQLString(groupId)},
            ${escapeSQLString(segmentId)},
            ${escapeSQLString(group.group_name || group.name || `Group ${i+1}`)},
            ${i+1},
            ${escapeSQLString(groupCondition)},
            ${(group.between_group_condition || segmentData.groupConditions?.[i]) ? escapeSQLString(group.between_group_condition || segmentData.groupConditions[i]) : 'NULL'},
            ${group.description ? escapeSQLString(group.description) : 'NULL'}
          )
        `;
        
        await executeAppSchemaQuery(groupQuery);
        
        // Process filters in this group
        if (group.filters && Array.isArray(group.filters) && group.filters.length > 0) {
          for (let j = 0; j < group.filters.length; j++) {
            const filter = group.filters[j];
            const filterId = uuidv4();
            
            // Map frontend filter properties to backend properties if needed
            const columnName = filter.column_name || filter.column;
            const columnDataType = filter.column_data_type || filter.dataType || 'VARCHAR';
            const filterOperator = filter.filter_operator || filter.operator;
            
            // Handle date preset filters
            let filterValue = filter.filter_value || filter.value;
            let filterValue2 = filter.filter_value_2 || filter.value2;
            
            // Extract second value from array if filter_value is an array
            if (Array.isArray(filter.filter_value) && filter.filter_value.length > 1 && !filterValue2) {
                filterValue2 = filter.filter_value[1];
            }
            
            let datePreset = filter.date_preset;
            
            // If this is a date preset filter from the frontend
            if (filter.date_preset || 
                (Array.isArray(filterValue) && filterValue.length === 0 && 
                 filterOperator && filterOperator.startsWith('LAST_'))) {
              
              // If date_preset is not explicitly set but operator looks like a date preset
              if (!datePreset && filterOperator && (
                  filterOperator.startsWith('LAST_') || 
                  filterOperator.startsWith('THIS_'))) {
                datePreset = normalizeDatePreset(filterOperator.toLowerCase());
              }
              
              // If we have a date preset, calculate the date range
              if (datePreset) {
                const normalizedPreset = normalizeDatePreset(datePreset);
                const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
                
                if (startDate && endDate) {
                  filterValue = formatDateForSQL(startDate);
                  filterValue2 = formatDateForSQL(endDate);
                }
              }
            }
            
            // Insert filter
            const filterQuery = `
              INSERT INTO filters (
                id,
                filter_group_id,
                column_name,
                column_data_type,
                filter_operator,
                filter_value,
                filter_value_2,
                filter_order,
                is_active,
                date_preset
              )
              VALUES (
                ${escapeSQLString(filterId)},
                ${escapeSQLString(groupId)},
                ${escapeSQLString(columnName)},
                ${escapeSQLString(columnDataType)},
                ${escapeSQLString(filterOperator)},
                ${filterValue !== undefined ? (Array.isArray(filterValue) ? 
                  (filterValue.length > 0 ? escapeSQLString(filterValue[0]) : 'NULL') : 
                  escapeSQLString(filterValue)) : 'NULL'},
                ${(filterValue2 !== undefined && filterValue2 !== null && filterValue2 !== '') ? 
                  escapeSQLString(filterValue2) : 'NULL'},
                ${j+1},
                ${filter.is_active === undefined ? 'TRUE' : filter.is_active},
                ${datePreset ? escapeSQLString(datePreset) : 'NULL'}
              )
            `;
            
            await executeAppSchemaQuery(filterQuery);
          }
        }
      }
    }

    // Return success response with the created segment ID
    return res.status(201).json({
      success: true,
      data: {
        segment_id: segmentId
      },
      message: 'Segment created successfully'
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create segment',
      error: error.message
    });
  }
};

exports.getSegmentById = async (req, res) => {
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    // Get segment data
    const segmentQuery = `
      SELECT * FROM segments
      WHERE segment_id = ${escapeSQLString(segmentId)}
      AND is_active = TRUE
    `;

    const segmentResult = await executeAppSchemaQuery(segmentQuery);

    if (!segmentResult || segmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }

    const segment = segmentResult[0];
    
    // Parse segment_config if it's a string
    if (typeof segment.segment_config === 'string') {
      try {
        segment.segment_config = JSON.parse(segment.segment_config);
      } catch (error) {
        console.error('Error parsing segment_config:', error);
        segment.segment_config = {};
      }
    }

    // Get filter groups for this segment
    const groupsQuery = `
      SELECT * FROM filter_groups
      WHERE segment_id = ${escapeSQLString(segmentId)}
      ORDER BY group_order
    `;

    const filterGroups = await executeAppSchemaQuery(groupsQuery);
    
    // Get filters for each group
    const enhancedFilterGroups = [];
    
    // Track all dynamic date replacements for later use in SQL and config updates
    const dateReplacements = [];
    const datePresetSqlExpressions = [];
    
    for (const group of filterGroups) {
      const filtersQuery = `
        SELECT * FROM filters
        WHERE filter_group_id = ${escapeSQLString(group.id)}
        ORDER BY filter_order
      `;
      
      const filters = await executeAppSchemaQuery(filtersQuery);
      console.log("filters", filters);
      
      // Process date presets for each filter
      const processedFilters = filters.map(filter => {
        console.log("Processing filter:", JSON.stringify(filter));
        console.log("Filter date_preset:", filter.date_preset);
        console.log("Filter column_data_type:", filter.column_data_type);
        
        // Check condition explicitly and log the result
        const hasDatePreset = !!filter.date_preset;
        const isDateType = 
          (filter.column_data_type || '').toLowerCase() === 'date' || 
          (filter.column_data_type || '').toLowerCase() === 'datetime' || 
          (filter.column_data_type || '').toLowerCase() === 'timestamp';
        
        console.log("Has date preset:", hasDatePreset);
        console.log("Is date type:", isDateType);
        console.log("Should process date preset:", hasDatePreset && isDateType);
        
        // If this is a date filter with a preset, calculate the current date values
        if (hasDatePreset && isDateType) {
          console.log(`Processing filter with date_preset: ${filter.date_preset}`);
          
          // Normalize the date preset name
          const normalizedPreset = normalizeDatePreset(filter.date_preset);
          console.log(`Normalized preset: ${normalizedPreset}`);
          
          // Calculate dynamic date range based on preset - returns Date objects
          const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
          console.log(`Raw calculated dates: startDate=${startDate}, endDate=${endDate}`);
          
          // Format dates for SQL - ensure these are properly formatted as YYYY-MM-DD
          const formattedStartDate = startDate ? formatDateForSQL(startDate) : filter.filter_value;
          const formattedEndDate = endDate ? formatDateForSQL(endDate) : filter.filter_value_2 || filter.value[1];
          
          console.log(`Formatted dates: startDate=${formattedStartDate}, endDate=${formattedEndDate}`);
          
          // Generate SQL interval expression for this date preset
          const sqlIntervalExpression = generateSqlIntervalForPreset(normalizedPreset, filter.column_name);
          if (sqlIntervalExpression) {
            datePresetSqlExpressions.push({
              column: filter.column_name,
              preset: normalizedPreset,
              sqlExpression: sqlIntervalExpression
            });
          }
          
          // Store the date replacements for later use
          dateReplacements.push({
            column: filter.column_name,
            originalStartDate: filter.filter_value,
            originalEndDate: filter.filter_value_2,
            newStartDate: formattedStartDate,
            newEndDate: formattedEndDate,
            preset: normalizedPreset,
            operator: filter.filter_operator
          });
          
          // Create a new filter object with the updated values
          const updatedFilter = {
            ...filter,
            normalized_preset: normalizedPreset,
            dynamic_start_date: formattedStartDate,
            dynamic_end_date: formattedEndDate,
            // Override the original filter values with the dynamic ones
            filter_value: formattedStartDate,
            filter_value_2: formattedEndDate
          };
          
          console.log("Updated filter:", JSON.stringify(updatedFilter));
          return updatedFilter;
        }
        
        return filter;
      });
      
      console.log("processedFilters", processedFilters);
      enhancedFilterGroups.push({
        ...group,
        filters: processedFilters
      });
    }
    
    // Add filter groups to the response
    segment.filter_groups = enhancedFilterGroups;

    // Extract between-group conditions to create a groupConditions array
    const groupConditions = [];
    for (let i = 0; i < enhancedFilterGroups.length - 1; i++) {
      if (enhancedFilterGroups[i+1].between_group_condition) {
        groupConditions.push(enhancedFilterGroups[i+1].between_group_condition);
      } else {
        groupConditions.push('AND');
      }
    }
    segment.groupConditions = groupConditions;
    
    // Update segment_config with dynamic dates if needed
    if (segment.segment_config && dateReplacements.length > 0) {
      console.log("Updating segment_config with dynamic dates");
      
      // Update filterGroups in segment_config if they exist
      if (segment.segment_config.filterGroups && Array.isArray(segment.segment_config.filterGroups)) {
        console.log("Found filterGroups in segment_config:", JSON.stringify(segment.segment_config.filterGroups));
        
        segment.segment_config.filterGroups = segment.segment_config.filterGroups.map(configGroup => {
          if (configGroup.filters && Array.isArray(configGroup.filters)) {
            configGroup.filters = configGroup.filters.map(configFilter => {
              // Find matching date replacement based on column name and operator
              // We need to handle different operator formats (lastYear vs last_year)
              const replacement = dateReplacements.find(r => {
                // Match by column name first
                if (r.column !== configFilter.column_name) return false;
                
                // Then try to match by operator using various possible formats
                const configOp = configFilter.filter_operator?.toLowerCase() || '';
                const replacementOp = r.operator?.toLowerCase() || '';
                const replacementPreset = r.preset?.toLowerCase() || '';
                
                // Try to normalize the operator names for comparison
                const normalizedConfigOp = configOp
                  .replace('_', '')  // Remove underscores
                  .replace('last', 'last'); // Standardize 'last' prefix
                  
                const normalizedReplacementOp = replacementOp
                  .replace('_', '')  // Remove underscores
                  .replace('last', 'last'); // Standardize 'last' prefix
                  
                const normalizedReplacementPreset = replacementPreset
                  .replace('_', '')  // Remove underscores
                  .replace('last', 'last'); // Standardize 'last' prefix
                
                console.log(`Comparing operators: ${normalizedConfigOp} vs ${normalizedReplacementOp} or ${normalizedReplacementPreset}`);
                
                return normalizedConfigOp === normalizedReplacementOp || 
                       normalizedConfigOp === normalizedReplacementPreset;
              });
              
              if (replacement) {
                console.log(`Updating config filter for column ${configFilter.column_name} with operator ${configFilter.filter_operator}`);
                console.log(`Replacing values: ${configFilter.filter_value} -> ${replacement.newStartDate}, ${configFilter.filter_value_2} -> ${replacement.newEndDate}`);
                
                return {
                  ...configFilter,
                  filter_value: replacement.newStartDate,
                  filter_value_2: replacement.newEndDate,
                  dynamic_start_date: replacement.newStartDate,
                  dynamic_end_date: replacement.newEndDate
                };
              }
              return configFilter;
            });
          }
          return configGroup;
        });
        
        console.log("Updated segment_config.filterGroups:", JSON.stringify(segment.segment_config.filterGroups));
      }
    }

    // Update generated_sql with dynamic dates if needed
    if (segment.generated_sql && (dateReplacements.length > 0 || datePresetSqlExpressions.length > 0)) {
      console.log("Updating generated_sql with dynamic dates");
      
      // Store original SQL before making any changes
      segment.original_generated_sql = segment.generated_sql;
      
      // Instead of just replacing values in the existing SQL, let's regenerate it completely
      // based on the filter groups with their updated dynamic dates
      // This approach is similar to the frontend's generateSqlFromFilters function
      
      try {
        // Generate SQL from filter groups
        let whereClause = "";
        const enabledGroups = enhancedFilterGroups.filter(group => true); // All groups are enabled in backend
        
        const groupClauses = enabledGroups.map(group => {
          if (!group.filters || group.filters.length === 0) return "";
          
          const filterClauses = group.filters.map(filter => {
            let clause = "";
            
            // Check if this is a date filter with a preset
            const hasDatePreset = !!filter.date_preset;
            const isDateType = 
              (filter.column_data_type || '').toLowerCase() === 'date' || 
              (filter.column_data_type || '').toLowerCase() === 'datetime' || 
              (filter.column_data_type || '').toLowerCase() === 'timestamp';
            
            if (hasDatePreset && isDateType) {
              // Use SQL interval expression if available
              const datePresetSql = datePresetSqlExpressions.find(
                dps => dps.column === filter.column_name && dps.preset === filter.normalized_preset
              );
              
              if (datePresetSql) {
                // Use the SQL interval expression
                clause = datePresetSql.sqlExpression;
              } else {
                // Fall back to using the dynamically calculated dates
                clause = `${filter.column_name} BETWEEN '${filter.filter_value}' AND '${filter.filter_value_2}'`;
              }
            } else {
              // Handle regular operators
              switch (filter.filter_operator) {
                case 'equals':
                  clause = `${filter.column_name} = '${filter.filter_value}'`;
                  break;
                case 'notEquals':
                  clause = `${filter.column_name} <> '${filter.filter_value}'`;
                  break;
                case 'contains':
                  clause = `${filter.column_name} LIKE '%${filter.filter_value}%'`;
                  break;
                case 'notContains':
                  clause = `${filter.column_name} NOT LIKE '%${filter.filter_value}%'`;
                  break;
                case 'startsWith':
                  clause = `${filter.column_name} LIKE '${filter.filter_value}%'`;
                  break;
                case 'notStartsWith':
                  clause = `${filter.column_name} NOT LIKE '${filter.filter_value}%'`;
                  break;
                case 'endsWith':
                  clause = `${filter.column_name} LIKE '%${filter.filter_value}'`;
                  break;
                case 'notEndsWith':
                  clause = `${filter.column_name} NOT LIKE '%${filter.filter_value}'`;
                  break;
                case 'greaterThan':
                  clause = `${filter.column_name} > '${filter.filter_value}'`;
                  break;
                case 'greaterThanOrEqual':
                  clause = `${filter.column_name} >= '${filter.filter_value}'`;
                  break;
                case 'lessThan':
                  clause = `${filter.column_name} < '${filter.filter_value}'`;
                  break;
                case 'lessThanOrEqual':
                  clause = `${filter.column_name} <= '${filter.filter_value}'`;
                  break;
                case 'in':
                  if (Array.isArray(filter.filter_value)) {
                    const inValues = filter.filter_value.map(v => `'${v}'`).join(", ");
                    clause = `${filter.column_name} IN (${inValues})`;
                  } else {
                    const inValues = filter.filter_value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${filter.column_name} IN (${inValues})`;
                  }
                  break;
                case 'notIn':
                  if (Array.isArray(filter.filter_value)) {
                    const notInValues = filter.filter_value.map(v => `'${v}'`).join(", ");
                    clause = `${filter.column_name} NOT IN (${notInValues})`;
                  } else {
                    const notInValues = filter.filter_value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${filter.column_name} NOT IN (${notInValues})`;
                  }
                  break;
                case 'between':
                  if (Array.isArray(filter.filter_value) && filter.filter_value.length >= 2) {
                    clause = `${filter.column_name} BETWEEN '${filter.filter_value[0]}' AND '${filter.filter_value[1]}'`;
                  } else if (filter.filter_value && filter.filter_value_2) {
                    clause = `${filter.column_name} BETWEEN '${filter.filter_value}' AND '${filter.filter_value_2}'`;
                  }
                  break;
                case 'notBetween':
                  if (Array.isArray(filter.filter_value) && filter.filter_value.length >= 2) {
                    clause = `${filter.column_name} NOT BETWEEN '${filter.filter_value[0]}' AND '${filter.filter_value[1]}'`;
                  } else if (filter.filter_value && filter.filter_value_2) {
                    clause = `${filter.column_name} NOT BETWEEN '${filter.filter_value}' AND '${filter.filter_value_2}'`;
                  }
                  break;
                case 'isNull':
                  clause = `${filter.column_name} IS NULL`;
                  break;
                case 'isNotNull':
                  clause = `${filter.column_name} IS NOT NULL`;
                  break;
                default:
                  // Handle any date preset operators that might have been passed directly
                  if (filter.filter_value && filter.filter_value_2) {
                    clause = `${filter.column_name} BETWEEN '${filter.filter_value}' AND '${filter.filter_value_2}'`;
                  }
              }
            }
            
            return clause;
          }).filter(Boolean); // Remove empty clauses
          
          if (filterClauses.length === 0) return "";
          
          // Handle NOT condition for the group
          const groupCondition = group.group_condition || 'AND';
          const isNotCondition = group.not === true;
          
          if (isNotCondition) {
            return `NOT (${filterClauses.join(" AND ")})`;
          }
          
          return `(${filterClauses.join(` ${groupCondition} `)})`;
        }).filter(Boolean); // Remove empty group clauses
        
        if (groupClauses.length > 0) {
          // Use between-group conditions if available
          if (groupClauses.length > 1 && segment.groupConditions && segment.groupConditions.length > 0) {
            let finalClause = groupClauses[0];
            
            for (let i = 1; i < groupClauses.length; i++) {
              const condition = i - 1 < segment.groupConditions.length 
                ? segment.groupConditions[i - 1] 
                : "AND";
              finalClause += ` ${condition} ${groupClauses[i]}`;
            }
            
            whereClause = ` WHERE ${finalClause}`;
          } else {
            whereClause = ` WHERE ${groupClauses.join(" AND ")}`;
          }
        }
        
        // Get the table name from segment_config
        const tableName = segment.segment_config?.target_table || segment.table_id;
        
        // Generate the complete SQL
        const generatedSql = `SELECT * FROM ${tableName}${whereClause} LIMIT 1000`;
        console.log("Regenerated SQL:", generatedSql);
        
        // Update the generated_sql with the newly generated SQL
        segment.generated_sql = generatedSql;
      } catch (error) {
        console.error("Error regenerating SQL:", error);
        
        // If regeneration fails, fall back to the original approach of replacing values
        let updatedSql = segment.original_generated_sql;
        
        // Replace date values in SQL with dynamic interval expressions
        datePresetSqlExpressions.forEach(datePresetSql => {
          // Try to find patterns in the SQL that match this column with a BETWEEN clause
          const columnName = datePresetSql.column;
          const sqlExpression = datePresetSql.sqlExpression;
          
          // Pattern for: column BETWEEN 'date1' AND 'date2'
          const pattern = new RegExp(`(${columnName}\\s+BETWEEN\\s+['"]?[^'"\\s]+['"]?\\s+AND\\s+['"]?[^'"\\s]+['"]?)`, 'gi');
          
          if (pattern.test(updatedSql)) {
            // Reset the pattern's lastIndex
            pattern.lastIndex = 0;
            // Replace the matched pattern with the SQL interval expression
            updatedSql = updatedSql.replace(pattern, sqlExpression);
          }
        });
        
        // Check if the SQL is properly formed with closing brackets and LIMIT
        if (updatedSql.includes('WHERE (') && !updatedSql.includes(') LIMIT') && !updatedSql.endsWith(')')) {
          console.log("Adding missing closing bracket to SQL query");
          updatedSql += ')';
        }
        
        // Check if LIMIT clause is missing
        if (!updatedSql.toLowerCase().includes('limit ')) {
          console.log("Adding missing LIMIT clause to SQL query");
          updatedSql += ' LIMIT 1000';
        }
        
        console.log("Final SQL after fixes:", updatedSql);
        
        // Update the generated_sql with the fixed SQL
        segment.generated_sql = updatedSql;
      }
    }

    return res.status(200).json({
      success: true,
      data: segment
    });
  } catch (error) {
    console.error('Error fetching segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch segment',
      error: error.message
    });
  }
};

exports.updateSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const updateData = req.body;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    // Process filter groups to generate dynamic SQL expressions for date presets
    if (updateData.filter_groups && Array.isArray(updateData.filter_groups)) {
      const datePresetFilters = [];
      
      // Find all date preset filters
      updateData.filter_groups.forEach(group => {
        if (group.filters && Array.isArray(group.filters)) {
          group.filters.forEach(filter => {
            if (filter.date_preset || 
                (filter.operator && 
                 (filter.operator.startsWith('LAST_') || filter.operator.startsWith('THIS_')))) {
              
              let datePreset = filter.date_preset;
              
              // If date_preset is not explicitly set but operator looks like a date preset
              if (!datePreset && filter.operator) {
                datePreset = normalizeDatePreset(filter.operator.toLowerCase());
              }
              
              if (datePreset) {
                const columnName = filter.column_name || filter.column;
                const normalizedPreset = normalizeDatePreset(datePreset);
                
                // Generate SQL interval expression
                const sqlIntervalExpression = generateSqlIntervalForPreset(normalizedPreset, columnName);
                
                if (sqlIntervalExpression) {
                  datePresetFilters.push({
                    column: columnName,
                    preset: normalizedPreset,
                    sqlExpression: sqlIntervalExpression
                  });
                }
              }
            }
          });
        }
      });
      
      // Update custom SQL with dynamic date expressions if it exists
      if (updateData.custom_sql && datePresetFilters.length > 0) {
        let updatedSql = updateData.custom_sql;
        
        datePresetFilters.forEach(datePresetFilter => {
          const columnName = datePresetFilter.column;
          const sqlExpression = datePresetFilter.sqlExpression;
          
          // Pattern for: column BETWEEN 'date1' AND 'date2'
          const pattern = new RegExp(`(${columnName}\\s+BETWEEN\\s+['"]?[^'"\\s]+['"]?\\s+AND\\s+['"]?[^'"\\s]+['"]?)`, 'gi');
          
          if (pattern.test(updatedSql)) {
            // Reset the pattern's lastIndex
            pattern.lastIndex = 0;
            // Replace the matched pattern with the SQL interval expression
            updatedSql = updatedSql.replace(pattern, sqlExpression);
          }
        });
        
        // Update the custom_sql with the dynamic expressions
        updateData.custom_sql = updatedSql;
      }
      
      // Update generated_sql with dynamic date expressions if it exists
      if (updateData.generated_sql && datePresetFilters.length > 0) {
        let updatedSql = updateData.generated_sql;
        
        datePresetFilters.forEach(datePresetFilter => {
          const columnName = datePresetFilter.column;
          const sqlExpression = datePresetFilter.sqlExpression;
          
          // Pattern for: column BETWEEN 'date1' AND 'date2'
          const pattern = new RegExp(`(${columnName}\\s+BETWEEN\\s+['"]?[^'"\\s]+['"]?\\s+AND\\s+['"]?[^'"\\s]+['"]?)`, 'gi');
          
          if (pattern.test(updatedSql)) {
            // Reset the pattern's lastIndex
            pattern.lastIndex = 0;
            // Replace the matched pattern with the SQL interval expression
            updatedSql = updatedSql.replace(pattern, sqlExpression);
          }
        });
        
        // Update the generated_sql with the dynamic expressions
        updateData.generated_sql = updatedSql;
      }
      
      // If no custom_sql but we have filter groups, generate a new SQL with dynamic expressions
      if (!updateData.custom_sql && !updateData.generated_sql && datePresetFilters.length > 0) {
        // Generate SQL from filter groups
        let whereClause = "";
        const enabledGroups = updateData.filter_groups.filter(group => group.isEnabled !== false);
        
        const groupClauses = enabledGroups.map(group => {
          if (!group.filters || group.filters.length === 0) return "";
          
          const filterClauses = group.filters.map(filter => {
            let clause = "";
            
            // Check if this is a date filter with a preset
            const hasDatePreset = !!filter.date_preset || 
                (filter.operator && 
                 (filter.operator.startsWith('LAST_') || filter.operator.startsWith('THIS_')));
                 
            if (hasDatePreset) {
              // Find matching date preset SQL expression
              const datePresetSql = datePresetFilters.find(
                dps => dps.column === (filter.column_name || filter.column)
              );
              
              if (datePresetSql) {
                // Use the SQL interval expression
                clause = datePresetSql.sqlExpression;
              } else {
                // Fall back to using the dynamically calculated dates if available
                if (filter.value && filter.value2) {
                  clause = `${filter.column_name || filter.column} BETWEEN '${filter.value}' AND '${filter.value2}'`;
                }
              }
            } else {
              // Handle regular operators based on frontend operator format
              const columnName = filter.column_name || filter.column;
              const operator = filter.filter_operator || filter.operator;
              const value = filter.filter_value || filter.value;
              const value2 = filter.filter_value_2 || filter.value2;
              
              // Extract second value from array if value is an array
              let secondValue = value2;
              if (Array.isArray(filter.filter_value) && filter.filter_value.length > 1) {
                secondValue = filter.filter_value[1];
              }
              
              switch (operator) {
                case "=":
                  clause = `${columnName} = '${value}'`;
                  break;
                case "!=":
                  clause = `${columnName} <> '${value}'`;
                  break;
                case ">":
                  clause = `${columnName} > '${value}'`;
                  break;
                case ">=":
                  clause = `${columnName} >= '${value}'`;
                  break;
                case "<":
                  clause = `${columnName} < '${value}'`;
                  break;
                case "<=":
                  clause = `${columnName} <= '${value}'`;
                  break;
                case "BETWEEN":
                  if (value && secondValue) {
                    clause = `${columnName} BETWEEN '${value}' AND '${secondValue}'`;
                  } else if (value) {
                    // Handle case where only first value is provided
                    clause = `${columnName} >= '${value}'`;
                  }
                  break;
                case "NOT_BETWEEN":
                  if (value && secondValue) {
                    clause = `${columnName} NOT BETWEEN '${value}' AND '${secondValue}'`;
                  } else if (value) {
                    // Handle case where only first value is provided
                    clause = `${columnName} < '${value}'`;
                  }
                  break;
                case "LIKE":
                  clause = `${columnName} LIKE '%${value}%'`;
                  break;
                case "NOT LIKE":
                  clause = `${columnName} NOT LIKE '%${value}%'`;
                  break;
                case "STARTS_WITH":
                  clause = `${columnName} LIKE '${value}%'`;
                  break;
                case "NOT_STARTS_WITH":
                  clause = `${columnName} NOT LIKE '${value}%'`;
                  break;
                case "ENDS_WITH":
                  clause = `${columnName} LIKE '%${value}'`;
                  break;
                case "NOT_ENDS_WITH":
                  clause = `${columnName} NOT LIKE '%${value}'`;
                  break;
                case "IN":
                  if (Array.isArray(value)) {
                    const inValues = value.map(v => `'${v}'`).join(", ");
                    clause = `${columnName} IN (${inValues})`;
                  } else if (typeof value === 'string') {
                    const inValues = value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${columnName} IN (${inValues})`;
                  }
                  break;
                case "NOT_IN":
                  if (Array.isArray(value)) {
                    const notInValues = value.map(v => `'${v}'`).join(", ");
                    clause = `${columnName} NOT IN (${notInValues})`;
                  } else if (typeof value === 'string') {
                    const notInValues = value.split(',').map(v => `'${v.trim()}'`).join(", ");
                    clause = `${columnName} NOT IN (${notInValues})`;
                  }
                  break;
                case "IS NULL":
                  clause = `${columnName} IS NULL`;
                  break;
                case "IS NOT NULL":
                  clause = `${columnName} IS NOT NULL`;
                  break;
              }
            }
            
            return clause;
          }).filter(Boolean); // Remove empty clauses
          
          if (filterClauses.length === 0) return "";
          
          // Handle NOT condition for the group
          const groupCondition = group.group_condition || group.condition || 'AND';
          const isNotCondition = group.not === true;
          
          if (isNotCondition) {
            return `NOT (${filterClauses.join(" AND ")})`;
          }
          
          return `(${filterClauses.join(` ${groupCondition} `)})`;
        }).filter(Boolean); // Remove empty group clauses
        
        if (groupClauses.length > 0) {
          // Use between-group conditions if available
          if (groupClauses.length > 1 && updateData.groupConditions && updateData.groupConditions.length > 0) {
            let finalClause = groupClauses[0];
            
            for (let i = 1; i < groupClauses.length; i++) {
              const condition = i - 1 < updateData.groupConditions.length 
                ? updateData.groupConditions[i - 1] 
                : "AND";
              finalClause += ` ${condition} ${groupClauses[i]}`;
            }
            
            whereClause = ` WHERE ${finalClause}`;
          } else {
            whereClause = ` WHERE ${groupClauses.join(" AND ")}`;
          }
        }
        
        // Get the table name from segment_config or table_id
        const tableName = updateData.segment_config?.target_table || updateData.table_id;
        
        // Generate the complete SQL with dynamic expressions
        updateData.generated_sql = `SELECT * FROM ${tableName}${whereClause} LIMIT 1000`;
        console.log("Generated SQL with dynamic expressions:", updateData.generated_sql);
      }
    }

    const allowedFields = [
      'segment_name',
      'table_id',
      'description',
      'start_time',
      'end_time',
      'status',
      'segment_config',
      'generated_sql',
      'custom_sql',
      'is_template',
      'is_saved_table'
    ];

    const setValues = [];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        let value = updateData[field];
        if (field === 'segment_config') {
          value = JSON.stringify(value);
        }
        if (typeof value === 'boolean') {
          setValues.push(`${field} = ${value}`);
        } else {
          setValues.push(`${field} = ${value === null ? 'NULL' : escapeSQLString(value)}`);
        }
      }
    });

    if (setValues.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    setValues.push('updated_at = CURRENT_TIMESTAMP()');

    const query = `
      UPDATE segments
      SET ${setValues.join(', ')}
      WHERE segment_id = ${escapeSQLString(segmentId)}
    `;

    await executeAppSchemaQuery(query);

    // Always update filter groups and filters if provided, even if custom SQL is used
    if (updateData.filter_groups && Array.isArray(updateData.filter_groups)) {
      console.log("Updating filter groups for segment:", segmentId);
      console.log("Filter groups data:", JSON.stringify(updateData.filter_groups));
      
      // First delete all existing filter groups and filters
      const deleteFiltersQuery = `
        DELETE FROM filters
        WHERE filter_group_id IN (
          SELECT id FROM filter_groups
          WHERE segment_id = ${escapeSQLString(segmentId)}
        )
      `;
      await executeAppSchemaQuery(deleteFiltersQuery);

      const deleteGroupsQuery = `
        DELETE FROM filter_groups
        WHERE segment_id = ${escapeSQLString(segmentId)}
      `;
      await executeAppSchemaQuery(deleteGroupsQuery);

      // Then insert the new ones
      for (let i = 0; i < updateData.filter_groups.length; i++) {
        const group = updateData.filter_groups[i];
        const groupId = uuidv4();
        
        // Get the group condition for this group (applies to the relationship with the next group)
        let groupCondition = group.group_condition || group.condition || 'AND';
        
        // Insert filter group
        const groupQuery = `
          INSERT INTO filter_groups (
            id,
            segment_id,
            group_name,
            group_order,
            group_condition,
            between_group_condition,
            description
          )
          VALUES (
            ${escapeSQLString(groupId)},
            ${escapeSQLString(segmentId)},
            ${escapeSQLString(group.group_name || group.name || `Group ${i+1}`)},
            ${i+1},
            ${escapeSQLString(groupCondition)},
            ${(group.between_group_condition || updateData.groupConditions?.[i]) ? escapeSQLString(group.between_group_condition || updateData.groupConditions[i]) : 'NULL'},
            ${group.description ? escapeSQLString(group.description) : 'NULL'}
          )
        `;
        
        await executeAppSchemaQuery(groupQuery);
        
        // Process filters in this group
        if (group.filters && Array.isArray(group.filters) && group.filters.length > 0) {
          for (let j = 0; j < group.filters.length; j++) {
            const filter = group.filters[j];
            const filterId = uuidv4();
            
            // Map frontend filter properties to backend properties if needed
            const columnName = filter.column_name || filter.column;
            const columnDataType = filter.column_data_type || filter.dataType || 'VARCHAR';
            const filterOperator = filter.filter_operator || filter.operator;
            
            // Handle date preset filters
            let filterValue = filter.filter_value || filter.value;
            let filterValue2 = filter.filter_value_2 || filter.value2;
            
            // Extract second value from array if filter_value is an array
            if (Array.isArray(filter.filter_value) && filter.filter_value.length > 1 && !filterValue2) {
                filterValue2 = filter.filter_value[1];
            }
            
            let datePreset = filter.date_preset;
            
            // If this is a date preset filter from the frontend
            if (filter.date_preset || 
                (Array.isArray(filterValue) && filterValue.length === 0 && 
                 filterOperator && filterOperator.startsWith('LAST_'))) {
              
              // If date_preset is not explicitly set but operator looks like a date preset
              if (!datePreset && filterOperator && (
                  filterOperator.startsWith('LAST_') || 
                  filterOperator.startsWith('THIS_'))) {
                datePreset = normalizeDatePreset(filterOperator.toLowerCase());
              }
              
              // If we have a date preset, calculate the date range
              if (datePreset) {
                const normalizedPreset = normalizeDatePreset(datePreset);
                const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
                
                if (startDate && endDate) {
                  filterValue = formatDateForSQL(startDate);
                  filterValue2 = formatDateForSQL(endDate);
                }
              }
            }
            
            // Insert filter
            const filterQuery = `
              INSERT INTO filters (
                id,
                filter_group_id,
                column_name,
                column_data_type,
                filter_operator,
                filter_value,
                filter_value_2,
                filter_order,
                is_active,
                date_preset
              )
              VALUES (
                ${escapeSQLString(filterId)},
                ${escapeSQLString(groupId)},
                ${escapeSQLString(columnName)},
                ${escapeSQLString(columnDataType)},
                ${escapeSQLString(filterOperator)},
                ${filterValue !== undefined ? (Array.isArray(filterValue) ? 
                  (filterValue.length > 0 ? escapeSQLString(filterValue[0]) : 'NULL') : 
                  escapeSQLString(filterValue)) : 'NULL'},
                ${(filterValue2 !== undefined && filterValue2 !== null && filterValue2 !== '') ? 
                  escapeSQLString(filterValue2) : 'NULL'},
                ${j+1},
                ${filter.is_active === undefined ? 'TRUE' : filter.is_active},
                ${datePreset ? escapeSQLString(datePreset) : 'NULL'}
              )
            `;
            
            await executeAppSchemaQuery(filterQuery);
          }
        }
      }
    }

    // Fetch and return updated segment with filter groups and filters
    const updatedSegment = await executeAppSchemaQuery(
      `SELECT * FROM segments WHERE segment_id = ${escapeSQLString(segmentId)}`
    );

    if (!updatedSegment || updatedSegment.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found after update'
      });
    }

    const segment = updatedSegment[0];
    
    // Parse segment_config if it's a string
    if (typeof segment.segment_config === 'string') {
      try {
        segment.segment_config = JSON.parse(segment.segment_config);
      } catch (error) {
        console.error('Error parsing segment_config:', error);
        segment.segment_config = {};
      }
    }

    // Get filter groups for this segment
    const groupsQuery = `
      SELECT * FROM filter_groups
      WHERE segment_id = ${escapeSQLString(segmentId)}
      ORDER BY group_order
    `;

    const filterGroups = await executeAppSchemaQuery(groupsQuery);
    
    // Get filters for each group
    const enhancedFilterGroups = [];
    
    // Track all dynamic date replacements for later use in SQL and config updates
    const dateReplacements = [];
    
    for (const group of filterGroups) {
      const filtersQuery = `
        SELECT * FROM filters
        WHERE filter_group_id = ${escapeSQLString(group.id)}
        ORDER BY filter_order
      `;
      
      const filters = await executeAppSchemaQuery(filtersQuery);
      console.log("filters", filters);
      
      // Process date presets for each filter
      const processedFilters = filters.map(filter => {
        console.log("Processing filter:", JSON.stringify(filter));
        console.log("Filter date_preset:", filter.date_preset);
        console.log("Filter column_data_type:", filter.column_data_type);
        
        // Check condition explicitly and log the result
        const hasDatePreset = !!filter.date_preset;
        const isDateType = 
          (filter.column_data_type || '').toLowerCase() === 'date' || 
          (filter.column_data_type || '').toLowerCase() === 'datetime' || 
          (filter.column_data_type || '').toLowerCase() === 'timestamp';
        
        console.log("Has date preset:", hasDatePreset);
        console.log("Is date type:", isDateType);
        console.log("Should process date preset:", hasDatePreset && isDateType);
        
        // If this is a date filter with a preset, calculate the current date values
        if (hasDatePreset && isDateType) {
          console.log(`Processing filter with date_preset: ${filter.date_preset}`);
          
          // Normalize the date preset name
          const normalizedPreset = normalizeDatePreset(filter.date_preset);
          console.log(`Normalized preset: ${normalizedPreset}`);
          
          // Calculate dynamic date range based on preset - returns Date objects
          const { startDate, endDate } = calculateDateRangeFromPreset(normalizedPreset);
          console.log(`Raw calculated dates: startDate=${startDate}, endDate=${endDate}`);
          
          // Format dates for SQL - ensure these are properly formatted as YYYY-MM-DD
          const formattedStartDate = startDate ? formatDateForSQL(startDate) : filter.filter_value;
          const formattedEndDate = endDate ? formatDateForSQL(endDate) : filter.filter_value_2;
          
          console.log(`Formatted dates: startDate=${formattedStartDate}, endDate=${formattedEndDate}`);
          
          // Store the date replacements for later use
          dateReplacements.push({
            column: filter.column_name,
            originalStartDate: filter.filter_value,
            originalEndDate: filter.filter_value_2,
            newStartDate: formattedStartDate,
            newEndDate: formattedEndDate,
            preset: normalizedPreset,
            operator: filter.filter_operator
          });
          
          // Create a new filter object with the updated values
          const updatedFilter = {
            ...filter,
            normalized_preset: normalizedPreset,
            dynamic_start_date: formattedStartDate,
            dynamic_end_date: formattedEndDate,
            // Override the original filter values with the dynamic ones
            filter_value: formattedStartDate,
            filter_value_2: formattedEndDate
          };
          
          console.log("Updated filter:", JSON.stringify(updatedFilter));
          return updatedFilter;
        }
        
        return filter;
      });
      
      console.log("processedFilters", processedFilters);
      enhancedFilterGroups.push({
        ...group,
        filters: processedFilters
      });
    }
    
    // Add filter groups to the response
    segment.filter_groups = enhancedFilterGroups;

    // Extract between-group conditions to create a groupConditions array
    const groupConditions = [];
    for (let i = 0; i < enhancedFilterGroups.length - 1; i++) {
      if (enhancedFilterGroups[i+1].between_group_condition) {
        groupConditions.push(enhancedFilterGroups[i+1].between_group_condition);
      } else {
        groupConditions.push('AND');
      }
    }
    segment.groupConditions = groupConditions;

    return res.status(200).json({
      success: true,
      data: segment,
      message: 'Segment updated successfully',
      data: {
        segment_id: segmentId,
        ...segment
      }

    });
  } catch (error) {
    console.error('Error updating segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update segment',
      error: error.message
    });
  }
};

exports.deleteSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const userId = req.user.email; // Get the current user's email from the auth middleware
     
    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    // Get the user's role from the database
    const userRoleQuery = `
      SELECT role FROM users
      WHERE email = ${escapeSQLString(userId)}
    `;
    
    const userResult = await executeAppSchemaQuery(userRoleQuery);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userRole = userResult[0].role;
    console.log("userRole is", userRole);

    // First, check if the segment exists and who created it
    const segmentQuery = `
      SELECT created_by FROM segments
      WHERE segment_id = ${escapeSQLString(segmentId)}
      AND is_active = TRUE
    `;
    
    const segmentResult = await executeAppSchemaQuery(segmentQuery);
    
    if (!segmentResult || segmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }
    
    const segment = segmentResult[0];
    
    // Check if the user is the creator of the segment or has an admin role
    if (segment.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the creator or an admin can delete this segment'
      });
    }

    // Soft delete by setting is_active to FALSE
    const softDeleteQuery = `
      UPDATE segments
      SET is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP()
      WHERE segment_id = ${escapeSQLString(segmentId)}
    `;
    await executeAppSchemaQuery(softDeleteQuery);

    return res.status(200).json({
      success: true,
      message: 'Segment deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate segment',
      error: error.message
    });
  }
};

exports.toggleSegmentStatus = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { status } = req.body; // Should be 'active' or 'disabled'
    const userId = req.user.email; // Get the current user's email from the auth middleware
    
    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }
    
    if (!status || (status !== 'active' && status !== 'disabled')) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (active or disabled)'
      });
    }

    // Get the user's role from the database
    const userRoleQuery = `
      SELECT role FROM users
      WHERE email = ${escapeSQLString(userId)}
    `;
    
    const userResult = await executeAppSchemaQuery(userRoleQuery);
    
    if (!userResult || userResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const userRole = userResult[0].role;

    // Check if the segment exists and who created it
    const segmentQuery = `
      SELECT created_by, status FROM segments
      WHERE segment_id = ${escapeSQLString(segmentId)}
      AND is_active = TRUE
    `;
    
    const segmentResult = await executeAppSchemaQuery(segmentQuery);
    
    if (!segmentResult || segmentResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Segment not found'
      });
    }
    
    const segment = segmentResult[0];
    
    // Check if the user is the creator of the segment or has an admin role
    if (segment.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only the creator or an admin can change the status of this segment'
      });
    }

    // Update the segment status
    const updateStatusQuery = `
      UPDATE segments
      SET status = ${escapeSQLString(status)},
          updated_at = CURRENT_TIMESTAMP()
      WHERE segment_id = ${escapeSQLString(segmentId)}
    `;
    
    await executeAppSchemaQuery(updateStatusQuery);

    return res.status(200).json({
      success: true,
      message: `Segment status updated to ${status}`,
      data: { status }
    });
  } catch (error) {
    console.error('Error updating segment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update segment status',
      error: error.message
    });
  }
};

exports.updateLastExecuted = async (req, res) => {
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    const query = `
      UPDATE segments
      SET last_executed = CURRENT_TIMESTAMP(),
          updated_at = CURRENT_TIMESTAMP()
      WHERE segment_id = ${escapeSQLString(segmentId)}
    `;

    await executeAppSchemaQuery(query);

    return res.status(200).json({
      success: true,
      message: 'Last executed timestamp updated successfully'
    });
  } catch (error) {
    console.error('Error updating last executed timestamp:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update last executed timestamp',
      error: error.message
    });
  }
};
