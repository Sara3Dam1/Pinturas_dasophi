const multer = require("multer");
const { randomUUID } = require("node:crypto");
const { uploadsDir } = require("../config");

const imageExtensions = new Map([
	["image/jpeg", ".jpg"],
	["image/png", ".png"],
	["image/webp", ".webp"],
	["image/gif", ".gif"],
	["image/avif", ".avif"],
]);

const upload = multer({
	storage: multer.diskStorage({
		destination: uploadsDir,
		filename: (_req, file, callback) => {
			callback(null, `${randomUUID()}${imageExtensions.get(file.mimetype) || ""}`);
		},
	}),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, callback) => {
		if (!imageExtensions.has(file.mimetype)) {
			const error = new Error("Envie uma imagem JPEG, PNG, WebP, GIF ou AVIF.");
			error.code = "INVALID_FILE_TYPE";
			return callback(error);
		}
		return callback(null, true);
	},
});

module.exports = upload;
