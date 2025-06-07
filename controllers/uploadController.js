const mongoose = require('mongoose');
const FileMetadata = require('../models/FileMetadata');

// Save file metadata to MongoDB
const saveFileMetadata = async (file) => {
    const metadata = new FileMetadata({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        uploadDate: new Date(),
    });
    return await metadata.save();
};

module.exports = { saveFileMetadata };
