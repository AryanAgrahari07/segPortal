const tableDefinition = {
  name: 'users',
  schema: `
    CREATE TABLE users (
      user_id STRING PRIMARY KEY,
      email STRING NOT NULL,
      role STRING NOT NULL,
      first_name STRING,
      last_name STRING,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      is_active BOOLEAN DEFAULT TRUE
    )
    USING DELTA 
    TBLPROPERTIES (
        'delta.feature.allowColumnDefaults' = 'supported'
    )
        
  `
};

module.exports = tableDefinition; 