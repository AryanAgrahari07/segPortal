const { executeQuery } = require('../../database/database.js');
const { v4: uuidv4 } = require('uuid');

// Helper function to escape SQL string values
const escapeSQLString = (str) => {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.toString().replace(/'/g, "''")}'`;
};

// Create a new filter group
exports.createFilterGroup = async (req, res) => {
  try {
    const { segment_id, group_name, group_order, group_condition, description } = req.body;

    // Validate required fields
    if (!segment_id || !group_name || group_order === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: segment_id, group_name, and group_order are required'
      });
    }

    const id = uuidv4();

    const query = `
      INSERT INTO filter_groups (
        id,
        segment_id,
        group_name,
        group_order,
        group_condition,
        description
      )
      VALUES (
        ${escapeSQLString(id)},
        ${escapeSQLString(segment_id)},
        ${escapeSQLString(group_name)},
        ${group_order},
        ${group_condition ? escapeSQLString(group_condition) : 'NULL'},
        ${description ? escapeSQLString(description) : 'NULL'}
      )
    `;

    await executeQuery(query);

    return res.status(201).json({
      success: true,
      data: { 
        id,
        segment_id,
        group_name,
        group_order,
        group_condition,
        description
      },
      message: 'Filter group created successfully'
    });
  } catch (error) {
    console.error('Error creating filter group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create filter group',
      error: error.message
    });
  }
};

// Get all filter groups for a segment
exports.getFilterGroupsBySegmentId = async (req, res) => {
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Segment ID is required'
      });
    }

    const query = `
      SELECT * FROM filter_groups
      WHERE segment_id = ${escapeSQLString(segmentId)}
      ORDER BY group_order
    `;

    const filterGroups = await executeQuery(query);

    return res.status(200).json({
      success: true,
      data: filterGroups
    });
  } catch (error) {
    console.error('Error fetching filter groups:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filter groups',
      error: error.message
    });
  }
};

// Get a single filter group by ID
exports.getFilterGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Filter group ID is required'
      });
    }

    const query = `
      SELECT * FROM filter_groups
      WHERE id = ${escapeSQLString(groupId)}
    `;

    const result = await executeQuery(query);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter group not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    console.error('Error fetching filter group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filter group',
      error: error.message
    });
  }
};

// Update a filter group
exports.updateFilterGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const updateData = req.body;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Filter group ID is required'
      });
    }

    const allowedFields = [
      'group_name',
      'group_order',
      'group_condition',
      'description'
    ];

    const setValues = [];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'group_order') {
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
      UPDATE filter_groups
      SET ${setValues.join(', ')}
      WHERE id = ${escapeSQLString(groupId)}
    `;

    await executeQuery(query);

    // Fetch and return updated filter group
    const updatedFilterGroup = await executeQuery(
      `SELECT * FROM filter_groups WHERE id = ${escapeSQLString(groupId)}`
    );

    if (!updatedFilterGroup || updatedFilterGroup.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Filter group not found after update'
      });
    }

    return res.status(200).json({
      success: true,
      data: updatedFilterGroup[0],
      message: 'Filter group updated successfully'
    });
  } catch (error) {
    console.error('Error updating filter group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update filter group',
      error: error.message
    });
  }
};

// Delete a filter group
exports.deleteFilterGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Filter group ID is required'
      });
    }

    // First, delete all filters in this group
    await executeQuery(`
      DELETE FROM filters
      WHERE filter_group_id = ${escapeSQLString(groupId)}
    `);

    // Then delete the filter group
    const query = `
      DELETE FROM filter_groups
      WHERE id = ${escapeSQLString(groupId)}
    `;

    await executeQuery(query);

    return res.status(200).json({
      success: true,
      message: 'Filter group and associated filters deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting filter group:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete filter group',
      error: error.message
    });
  }
}; 