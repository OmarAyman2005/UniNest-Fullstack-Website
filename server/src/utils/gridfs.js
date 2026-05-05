// server/src/lib/gridfs.js
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

let bucket;

export function getGridFSBucket() {
  if (!bucket) {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Mongo connection not ready before using GridFSBucket");
    }
    bucket = new GridFSBucket(db, { bucketName: "ids" }); // creates ids.files + ids.chunks
  }
  return bucket;
}
