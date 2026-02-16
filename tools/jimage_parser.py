"""
JIMAGE file parser for extracting class files from Java module images.
Based on the OpenJDK jimage format specification.

JIMAGE format:
  - Header (magic, version, flags, resource/location count, etc.)
  - Redirect table (hash table for lookups)
  - Offset table
  - Location data (compressed location attributes)
  - String table
  - Resource data (actual class file bytes, etc.)
"""

import struct
import sys
import os
from pathlib import Path

# JIMAGE magic number
JIMAGE_MAGIC = 0xDADAFECA
JIMAGE_MAGIC_INVERTED = 0xCAFEDADA

# Location attribute kinds
ATTRIBUTE_END = 0
ATTRIBUTE_MODULE = 1
ATTRIBUTE_PARENT = 2
ATTRIBUTE_BASE = 3
ATTRIBUTE_EXTENSION = 4
ATTRIBUTE_OFFSET = 5
ATTRIBUTE_COMPRESSED = 6
ATTRIBUTE_UNCOMPRESSED = 7

ATTRIBUTE_NAMES = {
    0: "END",
    1: "MODULE",
    2: "PARENT",
    3: "BASE",
    4: "EXTENSION",
    5: "OFFSET",
    6: "COMPRESSED",
    7: "UNCOMPRESSED",
}

class JImageHeader:
    def __init__(self, data):
        # Header is 16 bytes
        magic = struct.unpack_from('<I', data, 0)[0]
        if magic == JIMAGE_MAGIC_INVERTED:
            self.endian = '<'
        elif magic == JIMAGE_MAGIC:
            self.endian = '>'
        else:
            raise ValueError(f"Not a JIMAGE file, magic: 0x{magic:08X}")

        fmt = self.endian + 'IIIIII'
        values = struct.unpack_from(fmt, data, 0)
        self.magic = values[0]
        self.version_major = values[1] >> 16
        self.version_minor = values[1] & 0xFFFF
        self.flags = values[2]
        self.resource_count = values[3]
        self.table_length = values[4]
        self.locations_size = values[5]

        # Read strings size from offset 24
        self.strings_size = struct.unpack_from(self.endian + 'I', data, 24)[0]

    def __repr__(self):
        return (f"JImageHeader(version={self.version_major}.{self.version_minor}, "
                f"resources={self.resource_count}, table_len={self.table_length}, "
                f"locations_size={self.locations_size}, strings_size={self.strings_size})")


class JImageParser:
    def __init__(self, filepath):
        self.filepath = filepath
        self.f = open(filepath, 'rb')
        self.data = self.f.read()
        self.f.close()

        # Parse header
        self.header = JImageHeader(self.data)
        self.endian = self.header.endian
        print(f"Header: {self.header}")
        print(f"File size: {len(self.data)} bytes")

        # Calculate section offsets
        # Header size is 8 * 4 = 32 bytes in newer formats
        # But let's compute based on the actual JIMAGE layout
        self.header_size = self._compute_header_size()

        # The redirect table follows the header
        self.redirect_offset = self.header_size
        self.redirect_size = self.header.table_length * 4

        # Offset table follows redirect table
        self.offsets_offset = self.redirect_offset + self.redirect_size
        self.offsets_size = self.header.table_length * 4

        # Location data follows offsets
        self.locations_offset = self.offsets_offset + self.offsets_size
        self.locations_size = self.header.locations_size

        # String table follows locations
        self.strings_offset = self.locations_offset + self.locations_size
        self.strings_size = self.header.strings_size

        # Resource data follows strings
        self.resources_offset = self.strings_offset + self.strings_size

        print(f"Redirect table: offset={self.redirect_offset}, size={self.redirect_size}")
        print(f"Offsets table:  offset={self.offsets_offset}, size={self.offsets_size}")
        print(f"Locations:      offset={self.locations_offset}, size={self.locations_size}")
        print(f"Strings:        offset={self.strings_offset}, size={self.strings_size}")
        print(f"Resources:      offset={self.resources_offset}")

    def _compute_header_size(self):
        # JIMAGE header in OpenJDK is typically:
        # 4 bytes magic + 4 bytes version + 4 bytes flags +
        # 4 bytes resource_count + 4 bytes table_length +
        # 4 bytes locations_size + 4 bytes strings_size
        # = 28 bytes, but may be padded
        # Let's read more carefully from the actual data
        # In practice the header is variable - let's scan for known structure
        # Actually the standard header is:
        # uint32 magic, version, flags, resourceCount, tableLength, locationsSize, stringsSize
        # = 7 * 4 = 28 bytes
        return 28

    def get_string(self, offset):
        """Get a null-terminated modified-UTF8 string from the string table."""
        if offset < 0 or offset >= self.strings_size:
            return ""
        start = self.strings_offset + offset
        end = self.data.index(b'\x00', start)
        raw = self.data[start:end]

        # Handle compact string format: first byte may encode string with shared prefix
        # In JIMAGE, strings can start with:
        # 0x01 = use UTF-8 directly
        # 0x02..0x7F = use the byte value as a character
        # 0x80.. = shared prefix encoding

        result = []
        i = 0
        while i < len(raw):
            b = raw[i]
            if b == 1:
                # Rest is plain UTF-8
                return raw[i+1:].decode('utf-8', errors='replace')
            elif b < 128:
                result.append(chr(b))
            else:
                # Modified UTF-8 multi-byte
                if (b & 0xE0) == 0xC0 and i + 1 < len(raw):
                    c = ((b & 0x1F) << 6) | (raw[i+1] & 0x3F)
                    result.append(chr(c))
                    i += 1
                elif (b & 0xF0) == 0xE0 and i + 2 < len(raw):
                    c = ((b & 0x0F) << 12) | ((raw[i+1] & 0x3F) << 6) | (raw[i+2] & 0x3F)
                    result.append(chr(c))
                    i += 2
                else:
                    result.append(f'\\x{b:02x}')
            i += 1
        return ''.join(result)

    def decode_location(self, loc_offset):
        """Decode a location entry from the locations section."""
        attrs = {}
        pos = self.locations_offset + loc_offset

        while pos < self.locations_offset + self.locations_size:
            if pos >= len(self.data):
                break

            byte = self.data[pos]
            kind = (byte >> 3) & 0x07
            length = (byte & 0x07)

            if kind == ATTRIBUTE_END:
                break

            pos += 1
            value = 0
            for i in range(length):
                if pos < len(self.data):
                    value = (value << 8) | self.data[pos]
                    pos += 1

            attrs[kind] = value

        return attrs

    def list_entries(self, module_filter=None):
        """List all entries, optionally filtered by module name."""
        entries = []

        for i in range(self.header.table_length):
            # Read offset from offsets table
            off_pos = self.offsets_offset + i * 4
            if off_pos + 4 > len(self.data):
                continue

            loc_offset = struct.unpack_from(self.endian + 'I', self.data, off_pos)[0]
            if loc_offset == 0:
                continue

            attrs = self.decode_location(loc_offset)
            if not attrs:
                continue

            module_str = self.get_string(attrs.get(ATTRIBUTE_MODULE, 0))
            parent_str = self.get_string(attrs.get(ATTRIBUTE_PARENT, 0))
            base_str = self.get_string(attrs.get(ATTRIBUTE_BASE, 0))
            ext_str = self.get_string(attrs.get(ATTRIBUTE_EXTENSION, 0))

            if module_filter and module_str != module_filter:
                continue

            offset = attrs.get(ATTRIBUTE_OFFSET, 0)
            compressed_size = attrs.get(ATTRIBUTE_COMPRESSED, 0)
            uncompressed_size = attrs.get(ATTRIBUTE_UNCOMPRESSED, 0)

            # Build full path
            if ext_str:
                full_path = f"/{module_str}/{parent_str}{base_str}.{ext_str}"
            else:
                full_path = f"/{module_str}/{parent_str}{base_str}"

            entries.append({
                'module': module_str,
                'parent': parent_str,
                'base': base_str,
                'extension': ext_str,
                'offset': offset,
                'compressed_size': compressed_size,
                'uncompressed_size': uncompressed_size,
                'full_path': full_path,
            })

        return entries

    def extract_resource(self, entry):
        """Extract raw bytes of a resource."""
        offset = self.resources_offset + entry['offset']
        size = entry['compressed_size'] if entry['compressed_size'] > 0 else entry['uncompressed_size']
        if size == 0:
            return b''
        return self.data[offset:offset + size]


def main():
    jimage_path = "C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/lib/modules"
    output_dir = "C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/extracted"

    parser = JImageParser(jimage_path)

    # List parser module entries
    print("\n=== Classes in ch.iddqd.aoe4.parser ===")
    parser_entries = parser.list_entries(module_filter="ch.iddqd.aoe4.parser")
    for entry in sorted(parser_entries, key=lambda e: e['full_path']):
        print(f"  {entry['full_path']} (size={entry['uncompressed_size']})")

    print(f"\nTotal entries in parser module: {len(parser_entries)}")

    # Also list GUI module
    print("\n=== Classes in ch.iddqd.aoe4.aoe4replayparsergui ===")
    gui_entries = parser.list_entries(module_filter="ch.iddqd.aoe4.aoe4replayparsergui")
    for entry in sorted(gui_entries, key=lambda e: e['full_path']):
        print(f"  {entry['full_path']} (size={entry['uncompressed_size']})")

    print(f"\nTotal entries in GUI module: {len(gui_entries)}")

    # Extract class files for parser module
    class_entries = [e for e in parser_entries if e['extension'] == 'class']
    print(f"\nExtracting {len(class_entries)} class files from parser module...")

    for entry in class_entries:
        rel_path = entry['full_path'].lstrip('/')
        out_path = os.path.join(output_dir, rel_path)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        data = parser.extract_resource(entry)
        with open(out_path, 'wb') as f:
            f.write(data)

    print(f"Extracted to: {output_dir}")

    # Also extract GUI module classes
    gui_class_entries = [e for e in gui_entries if e['extension'] == 'class']
    print(f"\nExtracting {len(gui_class_entries)} class files from GUI module...")

    for entry in gui_class_entries:
        rel_path = entry['full_path'].lstrip('/')
        out_path = os.path.join(output_dir, rel_path)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        data = parser.extract_resource(entry)
        with open(out_path, 'wb') as f:
            f.write(data)

    print("Done!")


if __name__ == '__main__':
    main()
