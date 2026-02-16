"""
Extract classes from JIMAGE format used by Java 9+ runtime images.

JIMAGE Location attribute encoding (from OpenJDK ImageLocation.java):
  - Each attribute starts with a header byte
  - If byte <= 7: END marker, stop parsing
  - Otherwise:
      kind = byte >>> 3 (unsigned right shift by 3)
      count = (byte & 7) + 1  (MINIMUM 1 byte of data!)
  - Then 'count' bytes follow as big-endian value
  - kind must be 1-7 (8+ is invalid)

Attribute kinds:
  0 = END (implicit, byte value <= 7)
  1 = MODULE (string offset)
  2 = PARENT (string offset)
  3 = BASE (string offset)
  4 = EXTENSION (string offset)
  5 = OFFSET (content offset in resource data)
  6 = COMPRESSED (compressed size)
  7 = UNCOMPRESSED (uncompressed size)
"""

import struct
import os
import sys
import zlib
from collections import Counter


def read_jimage(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()

    # Parse header (7 uint32 values, little-endian)
    endian = '<'
    magic, version, flags, resource_count, table_length, locations_size, strings_size = \
        struct.unpack_from(endian + '7I', data, 0)

    assert magic == 0xCAFEDADA, f"Not a JIMAGE file: magic=0x{magic:08X}"
    print(f"JIMAGE: magic=0x{magic:08X}, version={version>>16}.{version&0xFFFF}")
    print(f"Resources: {resource_count}, Table: {table_length}")
    print(f"Locations: {locations_size} bytes, Strings: {strings_size} bytes")

    header_size = 28  # 7 * 4 bytes

    # Section offsets
    redirect_off = header_size
    offsets_off = redirect_off + table_length * 4
    locations_off = offsets_off + table_length * 4
    strings_off = locations_off + locations_size
    resources_off = strings_off + strings_size

    print(f"Resource data starts at: {resources_off}")
    print(f"File size: {len(data)}")

    # String table
    string_data = data[strings_off:strings_off + strings_size]

    def get_string(offset):
        if offset < 0 or offset >= strings_size:
            return None
        end = string_data.index(b'\x00', offset)
        return string_data[offset:end].decode('utf-8', errors='replace')

    # Location decoder with CORRECTED attribute encoding
    def decode_location(loc_offset):
        """Decode location attributes from the locations section.

        Key insight: count = (byte & 7) + 1, NOT (byte & 7)!
        The +1 means there is ALWAYS at least 1 data byte per attribute.
        """
        attrs = [0] * 8  # ATTRIBUTE_COUNT = 8
        pos = locations_off + loc_offset

        while pos < locations_off + locations_size:
            b = data[pos]
            pos += 1

            if b <= 7:  # END
                break

            kind = (b >> 3) & 0xFF  # unsigned right shift
            count = (b & 7) + 1     # KEY: +1 means minimum 1 byte

            if kind > 7:
                # Invalid kind, skip this entry
                return None

            # Read 'count' bytes as big-endian value
            value = 0
            for j in range(count):
                if pos < len(data):
                    value = (value << 8) | data[pos]
                    pos += 1

            attrs[kind] = value

        return attrs

    # Process all entries from the offsets table
    entries = []
    for i in range(table_length):
        loc_off = struct.unpack_from(endian + 'I', data, offsets_off + i * 4)[0]
        if loc_off == 0:
            continue

        attrs = decode_location(loc_off)
        if attrs is None:
            continue

        module_off = attrs[1]  # ATTRIBUTE_MODULE
        parent_off = attrs[2]  # ATTRIBUTE_PARENT
        base_off = attrs[3]    # ATTRIBUTE_BASE
        ext_off = attrs[4]     # ATTRIBUTE_EXTENSION
        content_offset = attrs[5]  # ATTRIBUTE_OFFSET
        compressed = attrs[6]  # ATTRIBUTE_COMPRESSED
        uncompressed = attrs[7]  # ATTRIBUTE_UNCOMPRESSED

        module = get_string(module_off) or ''
        parent = get_string(parent_off) or ''
        base = get_string(base_off) or ''
        ext = get_string(ext_off) or ''

        if ext:
            full_path = f"/{module}/{parent}{base}.{ext}"
        else:
            full_path = f"/{module}/{parent}{base}"

        entries.append({
            'module': module,
            'parent': parent,
            'base': base,
            'extension': ext,
            'full_path': full_path,
            'content_offset': content_offset,
            'compressed_size': compressed,
            'uncompressed_size': uncompressed,
        })

    return entries, data, resources_off


def extract_resource(data, resources_off, entry):
    """Extract raw bytes of a resource from the JIMAGE data."""
    offset = resources_off + entry['content_offset']
    size = entry['compressed_size'] if entry['compressed_size'] > 0 else entry['uncompressed_size']
    if size == 0:
        return b''
    raw = data[offset:offset + size]

    # If compressed, try to decompress
    if entry['compressed_size'] > 0 and entry['compressed_size'] != entry['uncompressed_size']:
        try:
            # JIMAGE uses ZIP (deflate) compression with a header
            # The compressed resource has a CompressedResourceHeader:
            # uint32 magic (0xCAFEDADA), uint32 size, uint32 uncompressed_size, uint32 decompressor_name_offset, uint32 ...
            # Then the compressed data follows
            # Let's try raw zlib decompression first
            decompressed = zlib.decompress(raw)
            return decompressed
        except zlib.error:
            # Try with different wbits
            try:
                decompressed = zlib.decompress(raw, -zlib.MAX_WBITS)
                return decompressed
            except zlib.error:
                # Try skipping a header
                try:
                    # Skip 4-byte header
                    decompressed = zlib.decompress(raw[4:], -zlib.MAX_WBITS)
                    return decompressed
                except:
                    pass
        # Return raw if decompression fails
        return raw

    return raw


def main():
    jimage_path = "C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/lib/modules"
    output_dir = "C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/extracted"

    entries, data, resources_off = read_jimage(jimage_path)

    # Count by module
    mod_counts = Counter(e['module'] for e in entries)
    print(f"\nTotal entries: {len(entries)}")
    print("\nModules (sorted by entry count):")
    for mod, count in mod_counts.most_common(30):
        print(f"  {mod!r}: {count}")

    # Target modules
    target_modules = {
        'ch.iddqd.aoe4.parser',
        'ch.iddqd.aoe4.aoe4replayparsergui'
    }

    for mod_name in sorted(target_modules):
        mod_entries = [e for e in entries if e['module'] == mod_name]
        print(f"\n{'='*60}")
        print(f"Module: {mod_name} ({len(mod_entries)} entries)")
        print(f"{'='*60}")
        for e in sorted(mod_entries, key=lambda x: x['full_path']):
            print(f"  {e['full_path']} (uncomp={e['uncompressed_size']}, comp={e['compressed_size']})")

    # Extract class files for target modules
    for mod_name in sorted(target_modules):
        mod_entries = [e for e in entries if e['module'] == mod_name]
        class_entries = [e for e in mod_entries if e['extension'] == 'class']
        print(f"\nExtracting {len(class_entries)} class files from {mod_name}...")

        for entry in class_entries:
            rel_path = entry['full_path'].lstrip('/')
            out_path = os.path.join(output_dir, rel_path)
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            raw_data = extract_resource(data, resources_off, entry)
            with open(out_path, 'wb') as f:
                f.write(raw_data)

    print(f"\nExtracted to: {output_dir}")


if __name__ == '__main__':
    main()
