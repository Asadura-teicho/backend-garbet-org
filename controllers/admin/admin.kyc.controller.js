const User = require('../../models/User.model');
const mongoose = require('mongoose');

exports.getAllKYC = async (req, res) => {
    try {
        // 1. Check DB Connection Status
        const dbName = mongoose.connection.name;
        
        // Filter out admin users - only show regular users for KYC management
        const adminRoles = ['admin', 'super_admin', 'operator'];
        const users = await User.find({ 
            role: { $nin: adminRoles } // Exclude admin roles
        }).lean();
        
        console.log(`--- DIAGNOSTIC ---`);
        console.log(`Connected to Database: ${dbName}`);
        console.log(`Non-admin users found in '${User.collection.name}' collection: ${users.length}`);

        let formatted = users.map(u => ({
            _id: u._id,
            user: { 
                username: u.username || u.email || 'Unnamed User', 
                email: u.email || 'No Email' 
            },
            status: u.kycStatus || 'pending',
            createdAt: u.createdAt || new Date()
        }));

        // 2. FORCE DATA (If DB is empty, show this so you know the UI works)
        if (formatted.length === 0) {
            console.log("Empty DB: Sending test user to frontend.");
            formatted = [{
                _id: "test_123",
                user: { username: "Database_Is_Empty", email: "check_your_mongodb@test.com" },
                status: "action_required",
                createdAt: new Date()
            }];
        }

        return res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        console.error("KYC Controller Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateKYCStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;
        
        // Check if user exists and is not an admin
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Prevent updating KYC status for admin users
        const adminRoles = ['admin', 'super_admin', 'operator'];
        if (adminRoles.includes(user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot update KYC status for admin users' 
            });
        }
        
        await User.findByIdAndUpdate(userId, { kycStatus: status });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};