const tableDefinition = {
  name: 'filter_groups',
  schema: `
    CREATE TABLE filter_groups (
      id STRING NOT NULL,
      segment_id STRING NOT NULL,
      group_name STRING NOT NULL,
      group_order INT NOT NULL,
      group_condition STRING,
      description STRING,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      CONSTRAINT pk_filter_groups PRIMARY KEY (id),
      CONSTRAINT fk_filter_groups_segment_id FOREIGN KEY (segment_id) 
        REFERENCES segments(segment_id)
    )
    USING DELTA
    TBLPROPERTIES (
      'delta.feature.allowColumnDefaults' = 'supported'
    )
  `
};

module.exports = tableDefinition; 