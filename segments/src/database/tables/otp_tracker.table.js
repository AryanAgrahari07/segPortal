const tableDefinition = {
  name: 'OTP_tracker',
  schema: `
    CREATE TABLE OTP_tracker (
      email STRING NOT NULL,
      user_id STRING NOT NULL,
      OTP STRING NOT NULL,
      OTP_disable BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      expires_at TIMESTAMP NOT NULL,
      CONSTRAINT fk_otp_tracker_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ) 
    USING DELTA 
    TBLPROPERTIES (
        'delta.feature.allowColumnDefaults' = 'supported'
    )
  `
};

module.exports = tableDefinition; 