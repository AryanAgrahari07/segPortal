const usersTable = require('./users.table');
const otpTrackerTable = require('./otp_tracker.table');
const userSessionsTable = require('./user_sessions.table');
const segmentsTable = require('./segments.table');
const filterGroupsTable = require('./filter_groups.table');
const filtersTable = require('./filters.table');

const tables = [
  usersTable,
  otpTrackerTable,
  userSessionsTable,
  segmentsTable,
  filterGroupsTable,
  filtersTable,
];

module.exports = {
  tables
}; 