const {executeGoldSchemaQuery} = require('../../database/database.js');


const getAllTables = async (req, res) => {
  try {
    // Query to get all tables from the gold schema
    const query = `
      SHOW TABLES
    `;

    const result = await executeGoldSchemaQuery(query);

    // Return the list of tables
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Tables fetched successfully'
    });

  } catch (error) {
    console.error('Error fetching tables:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching tables',
      error: error.message
    });
  }
};

module.exports = {
  getAllTables
};
