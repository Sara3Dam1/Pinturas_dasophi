const multer = require("multer");
const { uploadsDir } = require("../config");

const upload = multer({ dest: uploadsDir });

module.exports = upload;
