import path from "path";
import fs from "fs/promises";
import User from "../models/User.js";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "ids");
(async () => { try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (_) {} })();

export const postCompanyProfile = async (req, res) => {
  try {
    const userId = req.user && (req.user.id || req.user._id);
    if (!userId) return res.status(401).json({ status: "error", message: "Auth required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ status: "error", message: "User not found" });

    // files come from multer memory storage
    const files = req.files || {};

    const now = new Date();

    // Helper to write a single file buffer to disk and return metadata
    const writeFileMeta = async (fileField) => {
      const f = files[fileField];
      if (!f || f.length === 0) return null;
      const file = f[0];
      const filename = `${userId}_${fileField}_${Date.now()}_${file.originalname}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.writeFile(filePath, file.buffer);
      return {
        url: `/uploads/ids/${filename}`,
        key: filename,
        mime: file.mimetype,
        size: file.size,
        uploadedAt: now,
      };
    };

    const taxCardMeta = await writeFileMeta("taxCard");
    const logoMeta = await writeFileMeta("logo");

    // attach to user.vendorProfile
    user.vendorProfile = user.vendorProfile || {};
    if (taxCardMeta) user.vendorProfile.taxCard = taxCardMeta;
    if (logoMeta) user.vendorProfile.logo = logoMeta;

    await user.save();

    return res.status(200).json({ status: "success", data: { vendorProfile: user.vendorProfile } });
  } catch (err) {
    console.error("postCompanyProfile error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
