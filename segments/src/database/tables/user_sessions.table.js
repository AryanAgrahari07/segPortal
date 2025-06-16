const tableDefinition = {
  name: 'user_sessions',
  schema: `
    CREATE TABLE user_sessions (
      session_id STRING NOT NULL,
      user_id STRING NOT NULL,
      refresh_token STRING NOT NULL,
      device_info STRING,
      ip_address STRING,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      expires_at TIMESTAMP NOT NULL,
      CONSTRAINT pk_user_sessions PRIMARY KEY (session_id),
      CONSTRAINT fk_user_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(user_id)
    ) 
    USING DELTA 
    TBLPROPERTIES (
      'delta.feature.allowColumnDefaults' = 'supported'
    )
  `
};

module.exports = tableDefinition; 