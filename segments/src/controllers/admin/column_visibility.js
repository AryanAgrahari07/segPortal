const { executeAppSchemaQuery, executeGoldSchemaQuery } = require('../../database/database.js');

/**
 * Get column visibility configuration for a specific table
 */
exports.getColumnVisibility = async (req, res) => {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }

    // First, get all columns from the table to make sure we have a complete list
    let tableColumns = [];
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
    } catch (error) {
      console.error('Error getting table columns:', error);
      return res.status(400).json({
        success: false,
        message: 'Error retrieving table columns',
        error: error.message
      });
    }

    // Get existing column visibility configurations
    const query = `
      SELECT 
        table_name, 
        column_name, 
        is_visible, 
        updated_at, 
        updated_by
      FROM 
        column_visibility
      WHERE 
        table_name = '${tableName}'
    `;
    
    const configurations = await executeAppSchemaQuery(query);
    
    // Create a map for quick lookups
    const configMap = {};
    configurations.forEach(config => {
      configMap[config.column_name] = {
        is_visible: config.is_visible,
        updated_at: config.updated_at,
        updated_by: config.updated_by
      };
    });
    
    // Combine table columns with visibility configurations
    const result = tableColumns.map(column => {
      const config = configMap[column] || { is_visible: true }; // Default to visible if no config exists
      return {
        table_name: tableName,
        column_name: column,
        is_visible: config.is_visible,
        updated_at: config.updated_at || null,
        updated_by: config.updated_by || null
      };
    });
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching column visibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch column visibility configurations',
      error: error.message
    });
  }
};

/**
 * Update column visibility configuration for a specific table
 */
exports.updateColumnVisibility = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { configurations, updatedBy } = req.body;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }
    
    if (!configurations || !Array.isArray(configurations)) {
      return res.status(400).json({
        success: false,
        message: 'Column configurations are required and must be an array'
      });
    }
    
    // Process each configuration update
    const updatedConfigs = [];
    
    for (const config of configurations) {
      const { column_name, is_visible } = config;
      
      if (!column_name) {
        return res.status(400).json({
          success: false,
          message: 'Column name is required for each configuration'
        });
      }
      
      // Only process the configuration if a column's visibility needs to be persisted
      // If is_visible is true (default value), we only need to add/update it if a record already exists
      // If is_visible is false, we need to add/update to persist this non-default state
      
      // Check if configuration already exists
      const checkQuery = `
        SELECT 
          table_name, 
          column_name, 
          is_visible
        FROM 
          column_visibility
        WHERE 
          table_name = '${tableName}'
          AND column_name = '${column_name}'
      `;
      
      const existingConfig = await executeAppSchemaQuery(checkQuery);
      
      if (existingConfig && existingConfig.length > 0) {
        // If the column is now visible (true) and we're explicitly setting it, update it to true
        // instead of deleting the record
        if (is_visible === true) {
          const updateQuery = `
            UPDATE column_visibility
            SET 
              is_visible = true,
              updated_at = CURRENT_TIMESTAMP(),
              updated_by = '${updatedBy || 'system'}'
            WHERE 
              table_name = '${tableName}'
              AND column_name = '${column_name}'
          `;
          
          await executeAppSchemaQuery(updateQuery);
        } else {
          // Otherwise update the existing record with the new visibility (false)
          const updateQuery = `
            UPDATE column_visibility
            SET 
              is_visible = ${is_visible},
              updated_at = CURRENT_TIMESTAMP(),
              updated_by = '${updatedBy || 'system'}'
            WHERE 
              table_name = '${tableName}'
              AND column_name = '${column_name}'
          `;
          
          await executeAppSchemaQuery(updateQuery);
        }
      } else if (is_visible === false) {
        // Only insert a new record if is_visible is false
        // (We don't need to store a record for the default true visibility)
        const insertQuery = `
          INSERT INTO column_visibility (
            table_name, 
            column_name, 
            is_visible, 
            updated_by
          )
          VALUES (
            '${tableName}',
            '${column_name}',
            ${is_visible},
            '${updatedBy || 'system'}'
          )
        `;
        
        await executeAppSchemaQuery(insertQuery);
      }
      
      updatedConfigs.push({
        table_name: tableName,
        column_name,
        is_visible,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || 'system'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Column visibility configurations updated successfully',
      data: updatedConfigs
    });
  } catch (error) {
    console.error('Error updating column visibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update column visibility configurations',
      error: error.message
    });
  }
};

/**
 * Get visible columns for a specific table
 * Used internally by other controllers
 */
exports.getVisibleColumns = async (tableName) => {
  try {
    if (!tableName) {
      throw new Error('Table name is required');
    }

    // First, get all columns from the table
    let tableColumns = [];
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
    } catch (error) {
      console.error('Error getting table columns:', error);
      throw new Error(`Error retrieving table columns: ${error.message}`);
    }

    // Get existing column visibility configurations
    const query = `
      SELECT 
        column_name, 
        is_visible
      FROM 
        column_visibility
      WHERE 
        table_name = '${tableName}'
    `;
    
    const configurations = await executeAppSchemaQuery(query);
    
    // Create a map for quick lookups
    const configMap = {};
    configurations.forEach(config => {
      configMap[config.column_name] = config.is_visible;
    });
    
    // Filter to only visible columns
    const visibleColumns = tableColumns.filter(column => {
      // If there's no configuration, default to visible
      return configMap[column] !== false;
    });
    
    return visibleColumns;
  } catch (error) {
    console.error('Error getting visible columns:', error);
    throw error;
  }
};

/**
 * Get columns used in segment filters
 * This is used to ensure columns used in segment filters are visible
 * regardless of their current visibility setting
 */
exports.getColumnsInSegmentFilters = async (segmentId) => {
  try {
    if (!segmentId || segmentId === 'null' || segmentId === 'undefined') {
      return [];
    }

    const columnsInFilters = new Set();
    
    // Get filter groups for the segment
    const filterGroupsQuery = `
      SELECT * 
      FROM filter_groups 
      WHERE segment_id = '${segmentId}'
    `;
    
    const filterGroups = await executeAppSchemaQuery(filterGroupsQuery);
    
    // For each filter group, get its filters
    for (const group of filterGroups) {
      const filtersQuery = `
        SELECT * 
        FROM filters 
        WHERE filter_group_id = '${group.id}'
      `;
      
      const filters = await executeAppSchemaQuery(filtersQuery);
      
      // Add column names used in filters to the set
      filters.forEach(filter => {
        if (filter.column_name) {
          columnsInFilters.add(filter.column_name);
        }
      });
    }
    
    return Array.from(columnsInFilters);
  } catch (error) {
    console.error('Error getting columns in segment filters:', error);
    return [];
  }
};

/**
 * Get combined visible columns including those used in segment filters
 * This ensures columns used in segment filters are visible regardless of visibility settings
 */
exports.getVisibleColumnsForSegment = async (tableName, segmentId) => {
  try {
    // Get standard visible columns
    const visibleColumns = await this.getVisibleColumns(tableName);
    
    // If no segmentId is provided, return standard visible columns
    if (!segmentId || segmentId === 'null' || segmentId === 'undefined') {
      return visibleColumns;
    }
    
    // Get columns used in segment filters
    const columnsInFilters = await this.getColumnsInSegmentFilters(segmentId);
    
    // Combine visible columns with columns used in filters
    const combinedColumns = new Set(visibleColumns);
    columnsInFilters.forEach(column => {
      combinedColumns.add(column);
    });
    
    return Array.from(combinedColumns);
  } catch (error) {
    console.error('Error getting combined visible columns for segment:', error);
    throw error;
  }
}; 