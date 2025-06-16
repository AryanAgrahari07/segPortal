const { executeQuery } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

// Create a new filter
exports.createFilter = async (req, res) => {
  try {
    const {
      filter_group_id,
      column_name,
      column_data_type,
      filter_operator,
      filter_value,
      filter_value_2,
      filter_order,
      is_active
    } = req.body;

    // Validate required fields
    if (!filter_group_id || !column_name || !column_data_type || !filter_operator || filter_order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: filter_group_id, column_name, column_data_type, filter_operator, and filter_order are required'
      });
    }

    const id = uuidv4();

    const query = `
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
        ${escapeSQLString(id)},
        ${escapeSQLString(filter_group_id)},
        ${escapeSQLString(column_name)},
        ${escapeSQLString(column_data_type)},
        ${escapeSQLString(filter_operator)},
        ${filter_value !== undefined ? escapeSQLString(filter_value) : 'NULL'},
        ${filter_value_2 !== undefined ? escapeSQLString(filter_value_2) : 'NULL'},
        ${filter_order},
        ${is_active === undefined ? 'TRUE' : is_active}
      )
    `;

    await executeQuery(query);

    return res.status(201).json({
      success: true,
      data: {
        id,
        filter_group_id,
        column_name,
        column_data_type,
        filter_operator,
        filter_value,
        filter_value_2,
        filter_order,
        is_active: is_active === undefined ? true : is_active
      },
      message: 'Filter created successfully'
    });
  } catch (error) {
    console.error('Error creating filter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create filter',
      error: error.message
    });
  }
};

// Get all filters for a filter group
exports.getFiltersByGroupId = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Filter group ID is required'
      });
    }

    const query = `
      SELECT * FROM filters
      WHERE filter_group_id = ${escapeSQLString(groupId)}
      ORDER BY filter_order
    `;

    const filters = await executeQuery(query);

    return res.status(200).json({
      success: true,
      data: filters
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filters',
      error: error.message
    });
  }
};

// Get a single filter by ID
exports.getFilterById = async (req, res) => {
  try {
    const { filterId } = req.params;

    if (!filterId) {
      return res.status(400).json({
        success: false,
        message: 'Filter ID is required'
      });
    }

    const query = `
      SELECT * FROM filters
      WHERE id = ${escapeSQLString(filterId)}
    `;

    const result = await executeQuery(query);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching filter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filter',
      error: error.message
    });
  }
};

// Update a filter
exports.updateFilter = async (req, res) => {
  try {
    const { filterId } = req.params;
    const updateData = req.body;

    if (!filterId) {
      return res.status(400).json({
        success: false,
        message: 'Filter ID is required'
      });
    }

    const allowedFields = [
      'column_name',
      'column_data_type',
      'filter_operator',
      'filter_value',
      'filter_value_2',
      'filter_order',
      'is_active'
    ];

    const setValues = [];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'filter_order') {
          setValues.push(`${field} = ${updateData[field]}`);
        } else if (field === 'is_active') {
          setValues.push(`${field} = ${updateData[field]}`);
        } else {
          setValues.push(`${field} = ${updateData[field] === null ? 'NULL' : escapeSQLString(updateData[field])}`);
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
      UPDATE filters
      SET ${setValues.join(', ')}
      WHERE id = ${escapeSQLString(filterId)}
    `;

    await executeQuery(query);

    // Fetch and return updated filter
    const updatedFilter = await executeQuery(
      `SELECT * FROM filters WHERE id = ${escapeSQLString(filterId)}`
    );

    if (!updatedFilter || updatedFilter.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter not found after update'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedFilter[0],
      message: 'Filter updated successfully'
    });
  } catch (error) {
    console.error('Error updating filter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update filter',
      error: error.message
    });
  }
};

// Delete a filter
exports.deleteFilter = async (req, res) => {
  try {
    const { filterId } = req.params;

    if (!filterId) {
      return res.status(400).json({
        success: false,
        message: 'Filter ID is required'
      });
    }

    const query = `
      DELETE FROM filters
      WHERE id = ${escapeSQLString(filterId)}
    `;

    await executeQuery(query);

    return res.status(200).json({
      success: true,
      message: 'Filter deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting filter:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete filter',
      error: error.message
    });
  }
};

// Get all filters for a segment (across all filter groups)
exports.getFiltersBySegmentId = async (req, res) => {
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    const query = `
      SELECT f.* 
      FROM filters f
      JOIN filter_groups g ON f.filter_group_id = g.id
      WHERE g.segment_id = ${escapeSQLString(segmentId)}
      ORDER BY g.group_order, f.filter_order
    `;

    const filters = await executeQuery(query);

    return res.status(200).json({
      success: true,
      data: filters
    });
  } catch (error) {
    console.error('Error fetching filters for segment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filters for segment',
      error: error.message
    });
  }
}; 