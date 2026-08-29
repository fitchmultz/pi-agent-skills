#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const channelsByColorType = new Map([
  [0, 1],
  [2, 3],
  [3, 1],
  [4, 2],
  [6, 4],
]);
const bitDepthsByColorType = new Map([
  [0, new Set([1, 2, 4, 8, 16])],
  [2, new Set([8, 16])],
  [3, new Set([1, 2, 4, 8])],
  [4, new Set([8, 16])],
  [6, new Set([8, 16])],
]);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function passLength(length, start, step) {
  return length <= start ? 0 : Math.ceil((length - start) / step);
}

function inspectRows(file, decoded, offset, rows, rowBytes) {
  for (let row = 0; row < rows; row += 1) {
    if (offset >= decoded.length) fail(file, "decoded scanline data is truncated");
    const filter = decoded[offset];
    if (filter > 4) fail(file, `invalid PNG filter ${filter} on decoded row ${row + 1}`);
    offset += 1 + rowBytes;
    if (offset > decoded.length) fail(file, "decoded scanline data is truncated");
  }
  return offset;
}

function verify(file) {
  const bytes = readFileSync(file);
  if (bytes.length < signature.length || !bytes.subarray(0, 8).equals(signature)) {
    fail(file, "invalid PNG signature");
  }

  let offset = 8;
  let chunkIndex = 0;
  let header;
  let sawEnd = false;
  const imageData = [];

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) fail(file, "truncated PNG chunk header");
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > bytes.length) fail(file, "truncated PNG chunk data");

    const type = bytes.toString("ascii", typeStart, dataStart);
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    const actualCrc = crc32(bytes.subarray(typeStart, dataEnd));
    if (actualCrc !== expectedCrc) fail(file, `${type} chunk CRC mismatch`);

    if (type === "IHDR") {
      if (chunkIndex !== 0 || header) fail(file, "IHDR must be the first and only header chunk");
      if (length !== 13) fail(file, "IHDR must contain 13 bytes");
      header = Buffer.from(bytes.subarray(dataStart, dataEnd));
    } else if (type === "IDAT") {
      if (!header) fail(file, "IDAT appears before IHDR");
      imageData.push(Buffer.from(bytes.subarray(dataStart, dataEnd)));
    } else if (type === "IEND") {
      if (length !== 0) fail(file, "IEND must be empty");
      sawEnd = true;
      offset = chunkEnd;
      break;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (!header) fail(file, "missing IHDR chunk");
  if (imageData.length === 0) fail(file, "missing IDAT chunk");
  if (!sawEnd) fail(file, "missing IEND chunk");
  if (offset !== bytes.length) fail(file, "unexpected bytes after IEND");

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const compression = header[10];
  const filterMethod = header[11];
  const interlace = header[12];
  if (width === 0 || height === 0) fail(file, "width and height must be positive");
  if (!channelsByColorType.has(colorType)) fail(file, `unsupported color type ${colorType}`);
  if (!bitDepthsByColorType.get(colorType).has(bitDepth)) {
    fail(file, `invalid bit depth ${bitDepth} for color type ${colorType}`);
  }
  if (compression !== 0 || filterMethod !== 0) fail(file, "unsupported compression or filter method");
  if (interlace !== 0 && interlace !== 1) fail(file, `invalid interlace method ${interlace}`);

  let decoded;
  try {
    decoded = inflateSync(Buffer.concat(imageData));
  } catch (error) {
    fail(file, `IDAT stream cannot be fully inflated: ${error.message}`);
  }

  const bitsPerPixel = channelsByColorType.get(colorType) * bitDepth;
  let decodedOffset = 0;
  if (interlace === 0) {
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
    decodedOffset = inspectRows(file, decoded, decodedOffset, height, rowBytes);
  } else {
    const startsX = [0, 4, 0, 2, 0, 1, 0];
    const startsY = [0, 0, 4, 0, 2, 0, 1];
    const stepsX = [8, 8, 4, 4, 2, 2, 1];
    const stepsY = [8, 8, 8, 4, 4, 2, 2];
    for (let pass = 0; pass < 7; pass += 1) {
      const passWidth = passLength(width, startsX[pass], stepsX[pass]);
      const passHeight = passLength(height, startsY[pass], stepsY[pass]);
      if (passWidth === 0 || passHeight === 0) continue;
      const rowBytes = Math.ceil((passWidth * bitsPerPixel) / 8);
      decodedOffset = inspectRows(file, decoded, decodedOffset, passHeight, rowBytes);
    }
  }

  if (decodedOffset !== decoded.length) {
    fail(file, `decoded byte count mismatch: consumed ${decodedOffset}, found ${decoded.length}`);
  }

  return { width, height };
}

if (process.argv.length < 3) {
  process.stderr.write("Usage: node verify_png.mjs IMAGE.png [IMAGE.png ...]\n");
  process.exit(2);
}

try {
  for (const file of process.argv.slice(2)) {
    const { width, height } = verify(file);
    process.stdout.write(`${width} ${height}\t${file}\n`);
  }
} catch (error) {
  process.stderr.write(`verify_png.mjs: ${error.message}\n`);
  process.exit(1);
}
