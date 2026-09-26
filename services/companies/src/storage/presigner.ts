/**
 * Signs short-lived URLs against S3-compatible object storage.
 *
 * Company logos and hero images never pass through this service: the browser
 * PUTs straight to the bucket with a URL signed here. That keeps asset traffic
 * off the API, and it means a handler bug cannot write into a bucket prefix the
 * URL was not scoped to — the signature covers one key and expires.
 *
 * The signing is AWS Signature Version 4 in query-string form, written against
 * the specification rather than pulled from an SDK, deliberately mirroring
 * `services/candidates/internal/storage/presign.go`: the platform's only use for
 * an object-storage client is this file, in either runtime.
 */
import { createHash, createHmac } from 'node:crypto';

import type { StorageConfig } from '../config';

const ALGORITHM = 'AWS4-HMAC-SHA256';
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // The protocol's own ceiling for query signing.

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
}

export class Presigner {
  private readonly scheme: string;
  private readonly host: string;

  /**
   * @param now injectable so a test can assert the signature against a fixed
   *   clock — a signature that only "looks right" is not a test.
   */
  constructor(
    private readonly config: StorageConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    const missing = (['endpoint', 'accessKey', 'secretKey', 'bucket'] as const).filter(
      (key) => config[key].trim() === '',
    );
    if (missing.length > 0) {
      throw new Error(`storage: missing configuration: ${missing.join(', ')}`);
    }

    let parsed: URL;
    try {
      parsed = new URL(config.endpoint);
    } catch {
      throw new Error(`storage: endpoint "${config.endpoint}" is not a valid URL`);
    }

    this.scheme = parsed.protocol.replace(':', '');
    this.host = parsed.host;
  }

  /**
   * Signs a single-object PUT.
   *
   * Content-Type is a signed header, so the upload must present exactly the type
   * that was checked against the allow-list: a client cannot obtain a URL for a
   * PNG and then push an HTML document through it.
   */
  presignPut(key: string, contentType: string, expirySeconds: number): PresignedUpload {
    if (key.trim() === '') {
      throw new Error('storage: an object key is required');
    }
    if (!Number.isInteger(expirySeconds) || expirySeconds <= 0 || expirySeconds > MAX_EXPIRY_SECONDS) {
      throw new Error(`storage: expiry must be between 1 and ${MAX_EXPIRY_SECONDS} seconds`);
    }

    const issuedAt = this.now();
    const url = this.sign('PUT', key, expirySeconds, { 'content-type': contentType }, issuedAt);

    return {
      url,
      method: 'PUT',
      // The browser is told exactly what to send, because a mismatch is rejected
      // by the bucket rather than by us — and that rejection is opaque.
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(issuedAt.getTime() + expirySeconds * 1_000),
    };
  }

  private sign(
    method: string,
    key: string,
    expirySeconds: number,
    signedHeaders: Record<string, string>,
    issuedAt: Date,
  ): string {
    const amzDate = formatAmzDate(issuedAt);
    const scopeDate = amzDate.slice(0, 8);
    const scope = `${scopeDate}/${this.config.region}/s3/aws4_request`;

    let host = this.host;
    let path = `/${key.replace(/^\/+/, '')}`;
    if (this.config.pathStyle) {
      path = `/${this.config.bucket}${path}`;
    } else {
      host = `${this.config.bucket}.${this.host}`;
    }

    // Host is always signed; whatever else the caller named joins it.
    const headers: Record<string, string> = { host };
    for (const [name, value] of Object.entries(signedHeaders)) {
      if (value.trim() !== '') {
        headers[name.toLowerCase()] = value.trim();
      }
    }

    const names = Object.keys(headers).sort();
    const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join('');
    const signedHeaderList = names.join(';');

    const query: Record<string, string> = {
      'X-Amz-Algorithm': ALGORITHM,
      'X-Amz-Credential': `${this.config.accessKey}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expirySeconds),
      'X-Amz-SignedHeaders': signedHeaderList,
    };

    const canonicalRequest = [
      method,
      encodePath(path),
      canonicalQuery(query),
      canonicalHeaders,
      signedHeaderList,
      // The body is not known at signing time for a browser upload.
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.config.secretKey}`, scopeDate), this.config.region), 's3'),
      'aws4_request',
    );

    query['X-Amz-Signature'] = hmac(signingKey, stringToSign).toString('hex');

    return `${this.scheme}://${host}${encodePath(path)}?${canonicalQuery(query)}`;
  }
}

/** YYYYMMDD'T'HHMMSS'Z' in UTC. */
function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Renders parameters sorted by name and encoded per RFC 3986.
 *
 * URLSearchParams is not usable here: it encodes a space as "+", which produces
 * a signature the bucket rejects.
 */
function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(params[name] ?? '')}`)
    .join('&');
}

/** Encodes each path segment but leaves the separators alone. */
function encodePath(path: string): string {
  return path.split('/').map(encodeRfc3986).join('/');
}

function encodeRfc3986(value: string): string {
  return Array.from(Buffer.from(value, 'utf8'))
    .map((byte) => {
      const char = String.fromCharCode(byte);
      return /[A-Za-z0-9\-_.~]/.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    })
    .join('');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}
