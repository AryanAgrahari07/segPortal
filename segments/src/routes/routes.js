const express = require("express");
const router = express.Router();
const { sendOTP } = require("../controllers/sendOTP/sendOTP.js");
const { verifyOTP } = require("../controllers/verifyotp/verifyOTP.js");
const { sanitizeInput } = require("../middleware/security.js");
const { verifyToken } = require("../middleware/auth.js");
const { refreshToken } = require("../controllers/refreshToken/refreshToken.js");
const { getAllTables } = require("../controllers/allTables/tables.js");
const { getAllSegments, getSegmentById, createSegment, updateSegment, deleteSegment, updateLastExecuted } = require("../controllers/segments/segment.js");
const { addUser, getAllUsers, isAdmin, updateUserStatus, updateUserRole } = require("../controllers/adduser/adduser.js");
const { getTableMetadata, getTableData, getTableDataWithSegment } = require("../controllers/tabledata/tabledata.js");
const filterGroupsController = require("../controllers/segments/filter_groups");
const filtersController = require("../controllers/segments/filters");

// otp
router.post("/send-otp", sanitizeInput, sendOTP);               ///
router.post("/verify-otp", sanitizeInput, verifyOTP);           ///

// refresh token
router.post("/refresh-token", sanitizeInput, refreshToken);      


// tables -list of all the tables in the database
router.get("/tables",verifyToken, getAllTables);                            ///
router.get("/table-metadata/:tableName", verifyToken, getTableMetadata);     ///          
router.post("/table-data/:tableName", verifyToken, getTableData);            ///             
router.get("/table-data-with-segment/:tableName/:segmentId", verifyToken, getTableDataWithSegment);

// segments
router.get("/get-segments", verifyToken, getAllSegments);                   ///
router.get("/segments/:segmentId", verifyToken, getSegmentById);            ///
router.post("/create-segment", verifyToken, createSegment);                 ///
router.put("/update-segment/:segmentId", verifyToken, updateSegment);
router.delete("/delete-segment/:segmentId", verifyToken, deleteSegment);
router.put('/:segmentId/executed', verifyToken, updateLastExecuted);

// Filter Group routes
router.get('/:segmentId/filter-groups', verifyToken, filterGroupsController.getFilterGroupsBySegmentId);
router.post('/filter-groups', verifyToken, filterGroupsController.createFilterGroup);         
router.get('/filter-groups/:groupId', verifyToken, filterGroupsController.getFilterGroupById); 
router.put('/filter-groups/:groupId', verifyToken, filterGroupsController.updateFilterGroup);
router.delete('/filter-groups/:groupId', verifyToken, filterGroupsController.deleteFilterGroup);

// Filter routes
router.get('/filter-groups/:groupId/filters', verifyToken, filtersController.getFiltersByGroupId);
router.get('/:segmentId/filters', verifyToken, filtersController.getFiltersBySegmentId);
router.post('/filters', verifyToken, filtersController.createFilter);
router.get('/filters/:filterId', verifyToken, filtersController.getFilterById);
router.put('/filters/:filterId', verifyToken, filtersController.updateFilter);
router.delete('/filters/:filterId', verifyToken, filtersController.deleteFilter);

// users
router.post("/add-user", verifyToken, addUser);        
router.get("/get-users", verifyToken, getAllUsers);                  ///
router.put("/users/:userId/status", verifyToken, updateUserStatus);
router.put("/users/:userId/role",  verifyToken, updateUserRole); 
 
router.get("/check", verifyToken, sanitizeInput, (req, res) => {
    res.status(200).json({
        success: true,
        message: "token is valid",
    });
});

module.exports = router;