const tableDefinition = {
  name: 'segments',
  schema: `
    CREATE TABLE segments (
      segment_id STRING NOT NULL,
      table_id STRING,
      segment_name STRING NOT NULL,
      description STRING,
      created_by STRING NOT NULL,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      status STRING,
      segment_config STRING NOT NULL,
      generated_sql STRING,
      custom_sql STRING,
      is_template BOOLEAN DEFAULT FALSE,
      is_saved_table BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      last_executed TIMESTAMP,
      CONSTRAINT pk_segments PRIMARY KEY (segment_id),
      CONSTRAINT fk_segments_created_by FOREIGN KEY (created_by) 
        REFERENCES users(user_id)
    )
    USING DELTA
    TBLPROPERTIES (
      'delta.feature.allowColumnDefaults' = 'supported'
    )
  `
};

module.exports = tableDefinition; 