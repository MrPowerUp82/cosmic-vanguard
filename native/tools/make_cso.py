"""Write a CISO v1 image from a PSP ISO and verify it by decoding every block."""
import struct
import sys
import zlib

BLOCK = 2048


def main(source, target):
    original = open(source, "rb").read()
    count = (len(original) + BLOCK - 1) // BLOCK
    header = struct.pack("<4sIQIBB2x", b"CISO", 24, len(original), BLOCK, 1, 0)
    offset = len(header) + (count + 1) * 4
    index, chunks = [], []
    for i in range(count):
        block = original[i * BLOCK:(i + 1) * BLOCK].ljust(BLOCK, b"\0")
        stream = zlib.compressobj(9, zlib.DEFLATED, -15)
        compressed = stream.compress(block) + stream.flush()
        if len(compressed) >= BLOCK:
            index.append(offset | 0x80000000)
            chunks.append(block)
            offset += BLOCK
        else:
            index.append(offset)
            chunks.append(compressed)
            offset += len(compressed)
    index.append(offset)
    with open(target, "wb") as out:
        out.write(header)
        out.write(struct.pack(f"<{len(index)}I", *index))
        out.writelines(chunks)
    decoded = bytearray()
    for i, chunk in enumerate(chunks):
        decoded += chunk if index[i] & 0x80000000 else zlib.decompress(chunk, -15)
    if decoded[:len(original)] != original:
        raise RuntimeError("CSO verification failed")
    print(f"Verified {target}: {len(original)} -> {offset} bytes")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
