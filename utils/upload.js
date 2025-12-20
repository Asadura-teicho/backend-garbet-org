// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');


// const kycUploadsDir = path.join(__dirname, '../uploads/kyc');
// const profileUploadsDir = path.join(__dirname, '../uploads/profile');

// [kycUploadsDir, profileUploadsDir].forEach((dir) => {
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }
// });


// const kycStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, kycUploadsDir);
//   },
//   filename: (req, file, cb) => {
//     const userId = req.user?.id || req.user?._id || 'unknown';
//     const ext = path.extname(file.originalname);
//     const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
//     cb(null, `${userId}_${Date.now()}_${safeName}${ext}`);
//   },
// });


// const profileStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, profileUploadsDir);
//   },
//   filename: (req, file, cb) => {
//     const userId = req.user?.id || req.user?._id || 'unknown';
//     const ext = path.extname(file.originalname);
//     cb(null, `${userId}_profile_${Date.now()}${ext}`);
//   },
// });

// const kycFileFilter = (req, file, cb) => {
//   const allowed = [
//     'image/jpeg',
//     'image/jpg',
//     'image/png',
//     'image/gif',
//     'application/pdf',
//   ];
//   allowed.includes(file.mimetype)
//     ? cb(null, true)
//     : cb(new Error('Only images and PDFs allowed'));
// };

// const profileFileFilter = (req, file, cb) => {
//   const allowed = [
//     'image/jpeg',
//     'image/jpg',
//     'image/png',
//     'image/gif',
//     'image/webp',
//   ];
//   allowed.includes(file.mimetype)
//     ? cb(null, true)
//     : cb(new Error('Only image files allowed'));
// };

// const kycUpload = multer({
//   storage: kycStorage,
//   fileFilter: kycFileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 },
// });

// const profileUpload = multer({
//   storage: profileStorage,
//   fileFilter: profileFileFilter,
//   limits: { fileSize: 3 * 1024 * 1024 },
// });


// const uploadKYC = kycUpload.fields([
//   { name: 'idFront', maxCount: 1 },
//   { name: 'idBack', maxCount: 1 },
//   { name: 'addressProof', maxCount: 1 },
// ]);


// const uploadProfilePicture = profileUpload.single('profilePicture');

// const getFileUrl = (filename) =>
//   filename ? `/uploads/kyc/${filename}` : null;

// const getProfilePictureUrl = (filename) =>
//   filename ? `/uploads/profile/${filename}` : null;

// const deleteFile = (filename) => {
//   if (!filename) return;
//   const filePath = path.join(kycUploadsDir, filename);
//   if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
// };

// const deleteProfilePicture = (filename) => {
//   if (!filename) return;
//   const filePath = path.join(profileUploadsDir, filename);
//   if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
// };

// module.exports = {
//   uploadKYC,

//   // Profile
//   uploadProfilePicture,

//   // Helpers
//   getFileUrl,
//   getProfilePictureUrl,
//   deleteFile,
//   deleteProfilePicture,

//   // Directories
//   uploadsDir: kycUploadsDir,
//   profileUploadsDir,
// };
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* -------------------------------------------
   Directories
------------------------------------------- */
const kycUploadsDir = path.join(__dirname, '../uploads/kyc');
const profileUploadsDir = path.join(__dirname, '../uploads/profile');

[kycUploadsDir, profileUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/* -------------------------------------------
   KYC Storage
------------------------------------------- */
const kycStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycUploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?._id || 'unknown';

    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9]/g, '_');

    cb(null, `${userId}_${Date.now()}_${safeName}${ext}`);
  },
});

/* -------------------------------------------
   Profile Storage
------------------------------------------- */
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?._id || 'unknown';
    const ext = path.extname(file.originalname).toLowerCase();

    cb(null, `${userId}_profile_${Date.now()}${ext}`);
  },
});

/* -------------------------------------------
   File Filters
------------------------------------------- */
const kycFileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed'));
  }
};

const profileFileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

/* -------------------------------------------
   Multer Instances
------------------------------------------- */
const kycUpload = multer({
  storage: kycStorage,
  fileFilter: kycFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter: profileFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

/* -------------------------------------------
   Upload Middlewares
------------------------------------------- */
const uploadKYC = kycUpload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
]);

const uploadProfilePicture = profileUpload.single('profilePicture');

/* -------------------------------------------
   Multer Error Handler
------------------------------------------- */
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err) {
    return res.status(400).json({ message: err.message });
  }

  next();
};

/* -------------------------------------------
   Helpers
------------------------------------------- */
const getFileUrl = (filename) =>
  filename ? `/uploads/kyc/${filename}` : null;

const getProfilePictureUrl = (filename) =>
  filename ? `/uploads/profile/${filename}` : null;

const deleteFile = (filename) => {
  if (!filename) return;
  const filePath = path.join(kycUploadsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const deleteProfilePicture = (filename) => {
  if (!filename) return;
  const filePath = path.join(profileUploadsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

/* -------------------------------------------
   Exports
------------------------------------------- */
module.exports = {
  // Upload middleware
  uploadKYC,
  uploadProfilePicture,
  multerErrorHandler,

  // Helpers
  getFileUrl,
  getProfilePictureUrl,
  deleteFile,
  deleteProfilePicture,

  // Directories
  uploadsDir: kycUploadsDir,
  profileUploadsDir,
};
