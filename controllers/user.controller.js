// controllers/usersController.js
const User = require('../models/User.model');
const { 
  getProfilePictureUrl, 
  deleteProfilePicture: deleteProfilePictureFile 
} = require('../utils/upload');

// Utility: Filter allowed fields for update
const filterFields = (obj, allowedFields) => {
  const filtered = {};
  Object.keys(obj).forEach(key => {
    if (allowedFields.includes(key)) {
      filtered[key] = obj[key];
    }
  });
  return filtered;
};

// -------------------------------------------
// @desc   Get all users
// @route  GET /api/users
// @access Private (Admin only)
// -------------------------------------------
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -__v');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc   Get user by ID
// @route  GET /api/users/:id
// @access Private
// -------------------------------------------
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc   Update user (Admin-safe update)
// @route  PUT /api/users/:id
// @access Private (Admin only)
// -------------------------------------------
exports.updateUser = async (req, res) => {
  try {
    // Allowed update fields
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'nationalId',
      'dateOfBirth',
      'iban',
      'bankName',
      'ibanHolderName',
      'status',
      'role',
      'currency',
      'dailyDepositLimit',
      'dailyWithdrawLimit',
      'kycStatus',
      'kycDocuments'
      // intentionally excluding: password, email, username
    ];

    const updates = filterFields(req.body, allowedFields);

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select('-password -__v');

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc   Delete user
// @route  DELETE /api/users/:id
// @access Private (Admin only)
// -------------------------------------------
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc   Upload profile picture
// @route  POST /api/users/profile-picture
// @access Private (User can only update their own)
// -------------------------------------------
exports.uploadProfilePicture = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      deleteProfilePictureFile(user.profilePicture);
    }

    // Update user with new profile picture filename
    user.profilePicture = req.file.filename;
    await user.save();

    // Return updated user with profile picture URL
    const profilePictureUrl = getProfilePictureUrl(user.profilePicture);

    res.json({
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture,
      profilePictureUrl: profilePictureUrl,
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: user.profilePicture,
        profilePictureUrl: profilePictureUrl
      }
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload profile picture' });
  }
};

// -------------------------------------------
// @desc   Delete profile picture
// @route  DELETE /api/users/profile-picture
// @access Private (User can only delete their own)
// -------------------------------------------
exports.deleteProfilePicture = async (req, res) => {
  try {
    // Get current user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a profile picture
    if (!user.profilePicture) {
      return res.status(400).json({ message: 'No profile picture to delete' });
    }

    // Delete file from disk
    deleteProfilePictureFile(user.profilePicture);

    // Remove profile picture from user
    user.profilePicture = null;
    await user.save();

    res.json({
      message: 'Profile picture deleted successfully',
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profilePicture: null
      }
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete profile picture' });
  }
};
