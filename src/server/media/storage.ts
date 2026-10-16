import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

// we generate every key, so anything else is rejected
const KEY_PATTERN = /^img\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export const isValidMediaKey = (key: string) => KEY_PATTERN.test(key);

function assertKey(key: string) {
  if (!isValidMediaKey(key)) throw new Error("Invalid media key");
}

// R2 in production, but any S3-compatible store works
class S3Storage implements ObjectStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const e = env();
    this.bucket = e.S3_BUCKET!;
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
      forcePathStyle: true,
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    assertKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=3600" }),
    );
  }

  async get(key: string) {
    assertKey(key);
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!out.Body) return null;
      return { body: await out.Body.transformToByteArray(), contentType: out.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async delete(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

// dev only
class LocalStorage implements ObjectStorage {
  private root = path.resolve(process.cwd(), ".data", "uploads");

  private file(key: string) {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid media key");
    return full;
  }

  async put(key: string, body: Buffer) {
    const full = this.file(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async get(key: string) {
    try {
      return { body: new Uint8Array(await readFile(this.file(key))), contentType: "image/webp" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
}

let instance: ObjectStorage | undefined;
export function storage(): ObjectStorage {
  instance ??= env().STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  return instance;
}

export const mediaUrl = (storageKey: string) => `/media/${storageKey}`;
