const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure media directory exists
if (!fs.existsSync(config.MEDIA_DIR)) {
    fs.mkdirSync(config.MEDIA_DIR, { recursive: true });
}

// All allowed MIME types
const ALLOWED_TYPES = [...config.ALLOWED_IMAGE_TYPES, ...config.ALLOWED_VIDEO_TYPES];

/**
 * Determines if a MIME type is an image type.
 * @param {string} mimetype
 * @returns {boolean}
 */
function isImageType(mimetype) {
    return config.ALLOWED_IMAGE_TYPES.includes(mimetype);
}

/**
 * Determines if a MIME type is a video type.
 * @param {string} mimetype
 * @returns {boolean}
 */
function isVideoType(mimetype) {
    return config.ALLOWED_VIDEO_TYPES.includes(mimetype);
}

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.MEDIA_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        const error = new Error('Only image (JPEG, PNG, GIF) and video (MP4, 3GP) files are supported');
        error.statusCode = 400;
        return cb(error, false);
    }
    cb(null, true);
};

// Multer instance with size limit based on type
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: config.MAX_VIDEO_SIZE // Use max video size as upper bound; validate per-type after upload
    }
});

module.exports = { upload, isImageType, isVideoType, ALLOWED_TYPES };
