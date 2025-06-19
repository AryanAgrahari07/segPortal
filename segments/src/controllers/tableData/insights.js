const { executeQuery } = require('../../database/database.js');

// Helper function to calculate statistics for numeric values
exports.calculateNumericStats = (values) => {
  if (!values || values.length === 0) return null;

  const sortedValues = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  
  // Calculate median (Q2)
  const midIndex = Math.floor(sortedValues.length / 2);
  const median = sortedValues.length % 2 === 0
    ? (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2
    : sortedValues[midIndex];
  
  // Calculate Q1 and Q3
  const q1Index = Math.floor(sortedValues.length * 0.25);
  const q3Index = Math.floor(sortedValues.length * 0.75);
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  
  // Calculate standard deviation
  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Calculate IQR and identify outliers
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = values.filter(val => val < lowerBound || val > upperBound);

  // Create distribution buckets
  const bucketCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
  const bucketSize = (max - min) / bucketCount;
  const buckets = Array(bucketCount).fill(0).map((_, i) => ({
    range: [Number((min + i * bucketSize).toFixed(2)), Number((min + (i + 1) * bucketSize).toFixed(2))],
    count: 0
  }));

  values.forEach(val => {
    if (val === max) {
      buckets[buckets.length - 1].count++;
      return;
    }
    const bucketIndex = Math.floor((val - min) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      buckets[bucketIndex].count++;
    }
  });

  return {
    count: values.length,
    sum: Number(sum.toFixed(2)),
    avg: Number(avg.toFixed(2)),
    median: Number(median.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    outlierCount: outliers.length,
    outlierPercentage: Number(((outliers.length / values.length) * 100).toFixed(1)),
    distribution: buckets
  };
};

// Helper function to calculate statistics for categorical values
exports.calculateCategoricalStats = (values) => {
  if (!values || values.length === 0) return null;

  const freqMap = {};
  let nullCount = 0;
  let emptyCount = 0;
  let totalValues = 0;

  values.forEach(value => {
    if (value === null || value === undefined) {
      nullCount++;
      return;
    }
    
    const strValue = String(value).trim();
    if (strValue === '') {
      emptyCount++;
      return;
    }
    
    freqMap[strValue] = (freqMap[strValue] || 0) + 1;
    totalValues++;
  });

  // Get all values sorted by frequency
  const sortedValues = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1]);
  
  // Top values
  const topValues = sortedValues
    .slice(0, 5)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Number(((count / values.length) * 100).toFixed(1))
    }));
    
  // Calculate entropy (measure of diversity)
  let entropy = 0;
  if (totalValues > 0) {
    sortedValues.forEach(([_, count]) => {
      const p = count / totalValues;
      entropy -= p * Math.log2(p);
    });
  }

  // Calculate dominance
  const dominance = sortedValues.length > 0 
    ? Number(((sortedValues[0][1] / totalValues) * 100).toFixed(1)) 
    : 0;

  return {
    uniqueValues: Object.keys(freqMap).length,
    nullCount,
    emptyCount,
    topValues,
    entropy: Number(entropy.toFixed(2)),
    dominance,
    diversity: sortedValues.length > 0 
      ? Number(((Object.keys(freqMap).length / totalValues) * 100).toFixed(1))
      : 0,
    distribution: sortedValues.slice(0, 10).map(([value, count]) => ({
      value,
      count,
      percentage: Number(((count / values.length) * 100).toFixed(1))
    }))
  };
};

// Helper function to calculate statistics for date values
exports.calculateDateStats = (values) => {
  if (!values || values.length === 0) return null;

  let minDate = null;
  let maxDate = null;
  let minTimestamp = Number.MAX_SAFE_INTEGER;
  let maxTimestamp = 0;
  let validDates = 0;
  let invalidDates = 0;
  
  // For distribution analysis
  const yearDistribution = {};
  const monthDistribution = {};
  const dayOfWeekDistribution = {};
  const validDateObjects = [];
  
  // Month names for better readability
  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Day names
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
  ];

  values.forEach(dateStr => {
    if (!dateStr) return;

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        validDates++;
        validDateObjects.push(date);
        const timestamp = date.getTime();
        const formattedDate = date.toISOString().split('T')[0];
        
        if (minDate === null || timestamp < minTimestamp) {
          minDate = formattedDate;
          minTimestamp = timestamp;
        }
        if (maxDate === null || timestamp > maxTimestamp) {
          maxDate = formattedDate;
          maxTimestamp = timestamp;
        }
        
        // Track distribution by year
        const year = date.getFullYear().toString();
        yearDistribution[year] = (yearDistribution[year] || 0) + 1;
        
        // Track distribution by month
        const month = monthNames[date.getMonth()];
        monthDistribution[month] = (monthDistribution[month] || 0) + 1;
        
        // Track distribution by day of week
        const dayOfWeek = dayNames[date.getDay()];
        dayOfWeekDistribution[dayOfWeek] = (dayOfWeekDistribution[dayOfWeek] || 0) + 1;
      } else {
        invalidDates++;
      }
    } catch (e) {
      invalidDates++;
    }
  });

  if (validDates === 0 || !minDate || !maxDate) return null;

  // Sort distributions
  const sortedYears = Object.entries(yearDistribution)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
  const sortedMonths = Object.entries(monthDistribution)
    .sort((a, b) => {
      const monthIndexA = monthNames.indexOf(a[0]);
      const monthIndexB = monthNames.indexOf(b[0]);
      return monthIndexA - monthIndexB;
    });
    
  const sortedDays = Object.entries(dayOfWeekDistribution)
    .sort((a, b) => {
      const dayIndexA = dayNames.indexOf(a[0]);
      const dayIndexB = dayNames.indexOf(b[0]);
      return dayIndexA - dayIndexB;
    });
    
  // Calculate date difference in days
  const dateRange = Math.ceil((maxTimestamp - minTimestamp) / (1000 * 60 * 60 * 24));
  
  // Detect weekly patterns
  let weeklyPattern = false;
  if (sortedDays.length > 0) {
    const dayValues = sortedDays.map(([_, count]) => count);
    const avgCount = dayValues.reduce((a, b) => a + b, 0) / dayValues.length;
    const maxDeviation = Math.max(...dayValues.map(v => Math.abs(v - avgCount)));
    weeklyPattern = maxDeviation > (0.2 * avgCount);
  }
  
  // Detect yearly patterns
  let yearlyPattern = false;
  if (sortedMonths.length > 6) {
    const monthValues = sortedMonths.map(([_, count]) => count);
    const avgCount = monthValues.reduce((a, b) => a + b, 0) / monthValues.length;
    const maxDeviation = Math.max(...monthValues.map(v => Math.abs(v - avgCount)));
    yearlyPattern = maxDeviation > (0.3 * avgCount);
  }
  
  // Detect trends
  let trend = "stable";
  if (validDateObjects.length > 10) {
    const isLongPeriod = dateRange > 90;
    const periodMap = {};
    
    validDateObjects.forEach(date => {
      let periodKey;
      if (isLongPeriod) {
        periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else {
        const weekNumber = Math.floor((date.getTime() - minTimestamp) / (7 * 24 * 60 * 60 * 1000));
        periodKey = `week-${weekNumber}`;
      }
      periodMap[periodKey] = (periodMap[periodKey] || 0) + 1;
    });
    
    const sortedPeriods = Object.entries(periodMap)
      .sort((a, b) => {
        if (isLongPeriod) {
          return a[0].localeCompare(b[0]);
        } else {
          return parseInt(a[0].split('-')[1]) - parseInt(b[0].split('-')[1]);
        }
      });
    
    if (sortedPeriods.length >= 3) {
      const firstPeriod = sortedPeriods[0][1];
      const lastPeriod = sortedPeriods[sortedPeriods.length - 1][1];
      const changePercent = ((lastPeriod - firstPeriod) / firstPeriod) * 100;
      
      if (changePercent > 20) {
        trend = "increasing";
      } else if (changePercent < -20) {
        trend = "decreasing";
      }
    }
  }

  return {
    validDates,
    invalidDates,
    nullPercentage: Number(((invalidDates / values.length) * 100).toFixed(1)),
    minDate,
    maxDate,
    dateRange,
    yearDistribution: sortedYears,
    monthDistribution: sortedMonths,
    dayOfWeekDistribution: sortedDays,
    weeklyPattern,
    yearlyPattern,
    trend
  };
};

// Helper function to calculate correlations between numeric columns
exports.calculateCorrelations = (data, numericColumns) => {
  const correlations = [];
  
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const col1 = numericColumns[i];
      const col2 = numericColumns[j];
      
      // Get all rows where both values are present
      const validRows = data.filter(row => 
        row[col1] !== null && 
        row[col1] !== undefined && 
        !isNaN(parseFloat(row[col1])) &&
        row[col2] !== null && 
        row[col2] !== undefined && 
        !isNaN(parseFloat(row[col2]))
      );
      
      if (validRows.length < 10) continue;
      
      // Calculate correlation coefficient (Pearson)
      const values1 = validRows.map(row => parseFloat(row[col1]));
      const values2 = validRows.map(row => parseFloat(row[col2]));
      
      const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
      const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;
      
      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;
      
      for (let k = 0; k < values1.length; k++) {
        const diff1 = values1[k] - mean1;
        const diff2 = values2[k] - mean2;
        
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }
      
      const correlation = numerator / (Math.sqrt(denom1) * Math.sqrt(denom2));
      
      // Only add significant correlations
      if (Math.abs(correlation) > 0.3) {
        correlations.push({
          columns: [col1, col2],
          correlation: Number(correlation.toFixed(2)),
          strength: Math.abs(correlation) > 0.7 ? 'strong' : 
                    Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
          direction: correlation > 0 ? 'positive' : 'negative'
        });
      }
    }
  }
  
  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
};

// Import the escapeSQLString function
const { buildFilterCondition } = require('./tabledata');

// Main function to generate insights
exports.generateTableInsights = async (req, res) => {
  try {
    const { tableName } = req.params;
    const { filterGroups, groupConditions, customSql } = req.body;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Table name is required'
      });
    }

    // Get the data based on filters or custom SQL
    let data;
    if (customSql) {
      data = await executeQuery(customSql);
    } else {
      // Build query with filters
      let query = `SELECT * FROM ${tableName}`;
      
      // Apply filters if provided
      if (filterGroups && Array.isArray(filterGroups) && filterGroups.length > 0) {
        const rootConditions = [];
        
        // Process each filter group at the root level
        for (const group of filterGroups) {
          const condition = buildFilterCondition(group);
          if (condition.sql) {
            rootConditions.push(`(${condition.sql})`);
          }
        }
        
        // Combine all root level groups with the specified conditions
        if (rootConditions.length > 0) {
          let whereClause = " WHERE ";
          
          for (let i = 0; i < rootConditions.length; i++) {
            whereClause += rootConditions[i];
            
            // Add the condition between this group and the next one if it's not the last group
            if (i < rootConditions.length - 1) {
              if (groupConditions && Array.isArray(groupConditions) && i < groupConditions.length) {
                const groupCondition = groupConditions[i]?.toUpperCase();
                
                // Handle different types of conditions
                if (groupCondition === 'AND') {
                  whereClause += ` AND `;
                } else if (groupCondition === 'OR') {
                  whereClause += ` OR `;
                } else if (groupCondition === 'NOT') {
                  whereClause += ` AND NOT `;
                } else {
                  // Default to AND if invalid
                  whereClause += ` AND `;
                }
              } else {
                // Default to AND if no conditions specified
                whereClause += ` AND `;
              }
            }
          }
          
          query += whereClause;
        }
      }
      
      console.log('Executing insights query:', query);
      data = await executeQuery(query);
    }
    
    console.log(`Retrieved ${data?.length || 0} rows for insights analysis`);

    if (!data || data.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRecords: 0,
          numericColumns: {},
          categoricalColumns: {},
          dateColumns: {},
          summary: {
            missingValues: {},
            correlations: [],
            mostCommonValues: [],
            outliers: [],
            distributions: {},
            trends: {}
          }
        }
      });
    }

    // Get column metadata
    const columnsQuery = `DESCRIBE TABLE ${tableName}`;
    const columns = await executeQuery(columnsQuery);

    // Initialize stats object
    const stats = {
      totalRecords: data.length,
      numericColumns: {},
      categoricalColumns: {},
      dateColumns: {},
      summary: {
        missingValues: {},
        correlations: [],
        mostCommonValues: [],
        outliers: [],
        distributions: {},
        trends: {}
      }
    };

    // Process each column
    const numericColumnNames = [];
    
    columns.forEach(column => {
      const colName = column.name || column.col_name;
      const colType = (column.type || column.data_type || '').toUpperCase();

      // Skip if column doesn't exist in data
      if (!data[0] || !data[0].hasOwnProperty(colName)) return;

      // Track missing values
      const values = data.map(row => row[colName]);
      const missingCount = values.filter(val => 
        val === null || 
        val === undefined || 
        val === ""
      ).length;

      stats.summary.missingValues[colName] = {
        count: missingCount,
        percentage: Number(((missingCount / data.length) * 100).toFixed(1))
      };

      // Process based on column type
      if (colType.includes('INT') || colType.includes('DECIMAL') || colType.includes('NUMERIC') || colType.includes('FLOAT') || colType.includes('DOUBLE')) {
        const numericValues = values
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => parseFloat(val))
          .filter(val => !isNaN(val));

        if (numericValues.length > 0) {
          numericColumnNames.push(colName);
          const numericStats = this.calculateNumericStats(numericValues);
          if (numericStats) {
            stats.numericColumns[colName] = numericStats;
            stats.summary.distributions[colName] = {
              type: 'numeric',
              buckets: numericStats.distribution
            };

            // Add outliers to summary if present
            if (numericStats.outlierCount > 0) {
              stats.summary.outliers.push({
                column: colName,
                count: numericStats.outlierCount,
                percentage: numericStats.outlierPercentage
              });
            }
          }
        }
      }
      else if (colType.includes('CHAR') || colType.includes('TEXT') || colType === 'BOOLEAN') {
        const categoricalStats = this.calculateCategoricalStats(values);
        if (categoricalStats) {
          stats.categoricalColumns[colName] = categoricalStats;
          stats.summary.distributions[colName] = {
            type: 'categorical',
            values: categoricalStats.distribution
          };

          // Add top values to summary
          if (categoricalStats.topValues.length > 0) {
            stats.summary.mostCommonValues.push({
              column: colName,
              values: categoricalStats.topValues.slice(0, 3)
            });
          }
        }
      }
      else if (colType.includes('DATE') || colType.includes('TIMESTAMP')) {
        const dateStats = this.calculateDateStats(values);
        if (dateStats) {
          stats.dateColumns[colName] = dateStats;

          // Add trends to summary if present
          if (dateStats.trend !== 'stable') {
            stats.summary.trends[colName] = {
              type: 'date',
              trend: dateStats.trend,
              period: dateStats.dateRange > 90 ? 'monthly' : 'weekly'
            };
          }
        }
      }
    });

    // Calculate correlations between numeric columns
    if (numericColumnNames.length >= 2) {
      stats.summary.correlations = this.calculateCorrelations(data, numericColumnNames);
    }

    // Sort summary arrays
    stats.summary.mostCommonValues.sort((a, b) => 
      b.values[0].percentage - a.values[0].percentage
    );
    stats.summary.outliers.sort((a, b) => b.percentage - a.percentage);

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error generating table insights:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate table insights',
      error: error.message
    });
  }
};