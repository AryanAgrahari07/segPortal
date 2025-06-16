const tableDefinition = {
  name: 'filters',
  schema: `
    CREATE TABLE filters (
      id STRING NOT NULL,
      filter_group_id STRING NOT NULL,
      column_name STRING NOT NULL,
      column_data_type STRING NOT NULL,
      filter_operator STRING NOT NULL,
      filter_value STRING,
      filter_value_2 STRING,
      filter_order INT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
      CONSTRAINT pk_filters PRIMARY KEY (id),
      CONSTRAINT fk_filters_filter_group_id FOREIGN KEY (filter_group_id) 
        REFERENCES filter_groups(id)
    )
    USING DELTA
    TBLPROPERTIES (
      'delta.feature.allowColumnDefaults' = 'supported'
    )
  `
};

module.exports = tableDefinition; 