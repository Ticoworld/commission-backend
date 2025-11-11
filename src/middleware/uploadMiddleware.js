const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

// Ensure the profiles directory exists
function ensureProfilesDir() {
  const dir = path.resolve('./public/uploads/profiles');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Configure storage for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureProfilesDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuid()}${ext}`;
    cb(null, uniqueName);
  },
});

// Filter to only accept image files (jpeg, png)
function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedImageTypes = ['.jpg', '.jpeg', '.png'];
  
  if (!allowedImageTypes.includes(ext)) {
    return cb(new Error('Only JPEG and PNG images are allowed for profile pictures'));
  }
  
  // Also check MIME type for additional security
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'));
  }
  
  cb(null, true);
}

// Configure multer for single profile picture upload
const uploadProfilePicture = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
  fileFilter: imageFileFilter,
});

module.exports = { uploadProfilePicture, ensureProfilesDir };
