const { executeQuery, executeAppSchemaQuery } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');
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

exports.createSegment = async (req, res) => {
  try {
    const segmentData = req.body;

    // Validate input data
    validateSegmentData(segmentData);

    const segmentId = uuidv4();
    const segmentConfig = JSON.stringify(segmentData.segment_config);

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
      for (let i = 0; i < segmentData.filter_groups.length; i++) {
        const group = segmentData.filter_groups[i];
        const groupId = uuidv4();
        
        // Get the group condition for this group (applies to the relationship with the next group)
        let groupCondition = null;
        if (segmentData.groupConditions && Array.isArray(segmentData.groupConditions) && i < segmentData.groupConditions.length) {
          groupCondition = segmentData.groupConditions[i];
        }
        
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
            ${escapeSQLString(group.group_name || `Group ${i+1}`)},
            ${i+1},
            ${groupCondition ? escapeSQLString(groupCondition) : 'NULL'},
            ${group.between_group_condition ? escapeSQLString(group.between_group_condition) : 'NULL'},
            ${group.description ? escapeSQLString(group.description) : 'NULL'}
          )
        `;
        
        await executeAppSchemaQuery(groupQuery);
        
        // Process filters in this group
        if (group.filters && Array.isArray(group.filters) && group.filters.length > 0) {
          for (let j = 0; j < group.filters.length; j++) {
            const filter = group.filters[j];
            const filterId = uuidv4();
            
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
                is_active
              )
              VALUES (
                ${escapeSQLString(filterId)},
                ${escapeSQLString(groupId)},
                ${escapeSQLString(filter.column_name)},
                ${escapeSQLString(filter.column_data_type)},
                ${escapeSQLString(filter.filter_operator)},
                ${filter.filter_value !== undefined ? escapeSQLString(filter.filter_value) : 'NULL'},
                ${filter.filter_value_2 !== undefined ? escapeSQLString(filter.filter_value_2) : 'NULL'},
                ${j+1},
                ${filter.is_active === undefined ? 'TRUE' : filter.is_active}
              )
            `;
            
            await executeAppSchemaQuery(filterQuery);
          }
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: { segment_id: segmentId, ...segmentData },
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
    segment.segment_config = JSON.parse(segment.segment_config);

    // Get filter groups for this segment
    const groupsQuery = `
      SELECT * FROM filter_groups
      WHERE segment_id = ${escapeSQLString(segmentId)}
      ORDER BY group_order
    `;

    const filterGroups = await executeAppSchemaQuery(groupsQuery);
    
    // Get filters for each group
    const enhancedFilterGroups = [];
    
    for (const group of filterGroups) {
      const filtersQuery = `
        SELECT * FROM filters
        WHERE filter_group_id = ${escapeSQLString(group.id)}
        ORDER BY filter_order
      `;
      
      const filters = await executeAppSchemaQuery(filtersQuery);
      
      enhancedFilterGroups.push({
        ...group,
        filters
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

    // Update filter groups and filters if provided
    if (updateData.filter_groups && Array.isArray(updateData.filter_groups)) {
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
        let groupCondition = null;
        if (updateData.groupConditions && Array.isArray(updateData.groupConditions) && i < updateData.groupConditions.length) {
          groupCondition = updateData.groupConditions[i];
        }
        
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
            ${escapeSQLString(group.group_name || `Group ${i+1}`)},
            ${i+1},
            ${groupCondition ? escapeSQLString(groupCondition) : 'NULL'},
            ${group.between_group_condition ? escapeSQLString(group.between_group_condition) : 'NULL'},
            ${group.description ? escapeSQLString(group.description) : 'NULL'}
          )
        `;
        
        await executeAppSchemaQuery(groupQuery);
        
        // Process filters in this group
        if (group.filters && Array.isArray(group.filters) && group.filters.length > 0) {
          for (let j = 0; j < group.filters.length; j++) {
            const filter = group.filters[j];
            const filterId = uuidv4();
            
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
                is_active
              )
              VALUES (
                ${escapeSQLString(filterId)},
                ${escapeSQLString(groupId)},
                ${escapeSQLString(filter.column_name)},
                ${escapeSQLString(filter.column_data_type)},
                ${escapeSQLString(filter.filter_operator)},
                ${filter.filter_value !== undefined ? escapeSQLString(filter.filter_value) : 'NULL'},
                ${filter.filter_value_2 !== undefined ? escapeSQLString(filter.filter_value_2) : 'NULL'},
                ${j+1},
                ${filter.is_active === undefined ? 'TRUE' : filter.is_active}
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
    segment.segment_config = JSON.parse(segment.segment_config);

    // Get filter groups for this segment
    const groupsQuery = `
      SELECT * FROM filter_groups
      WHERE segment_id = ${escapeSQLString(segmentId)}
      ORDER BY group_order
    `;

    const filterGroups = await executeAppSchemaQuery(groupsQuery);
    
    // Get filters for each group
    const enhancedFilterGroups = [];
    
    for (const group of filterGroups) {
      const filtersQuery = `
        SELECT * FROM filters
        WHERE filter_group_id = ${escapeSQLString(group.id)}
        ORDER BY filter_order
      `;
      
      const filters = await executeAppSchemaQuery(filtersQuery);
      
      enhancedFilterGroups.push({
        ...group,
        filters
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
      message: 'Segment updated successfully'
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
