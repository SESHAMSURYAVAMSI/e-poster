import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export default async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI in .env.local",
    );
  }

  if (!cached.promise) {
    const cleanUri = uri.replace(
  /(\.mongodb\.net)\/+eposter(?=[?]|$)/,
  "$1/eposter",
);

cached.promise = mongoose.connect(cleanUri, {
  dbName: "eposter",
  bufferCommands: false,
});
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}