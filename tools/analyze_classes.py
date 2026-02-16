"""
Analyze extracted Java class files from the AoE4 Replay Parser module.
Extracts constant pools, field/method signatures, and string constants
to understand the parser architecture.
"""

import struct
import os
import sys
from collections import defaultdict


class JavaClassAnalyzer:
    """Parse a Java .class file and extract useful information."""

    def __init__(self, filepath):
        self.filepath = filepath
        with open(filepath, 'rb') as f:
            self.data = f.read()
        self.pos = 0
        self.cp = [None]  # 1-indexed
        self.fields = []
        self.methods = []
        self.class_name = ''
        self.super_name = ''
        self.interfaces = []
        self.parse()

    def read_u1(self):
        val = self.data[self.pos]
        self.pos += 1
        return val

    def read_u2(self):
        val = struct.unpack_from('>H', self.data, self.pos)[0]
        self.pos += 2
        return val

    def read_u4(self):
        val = struct.unpack_from('>I', self.data, self.pos)[0]
        self.pos += 4
        return val

    def read_i4(self):
        val = struct.unpack_from('>i', self.data, self.pos)[0]
        self.pos += 4
        return val

    def read_i8(self):
        val = struct.unpack_from('>q', self.data, self.pos)[0]
        self.pos += 8
        return val

    def read_f4(self):
        val = struct.unpack_from('>f', self.data, self.pos)[0]
        self.pos += 4
        return val

    def read_f8(self):
        val = struct.unpack_from('>d', self.data, self.pos)[0]
        self.pos += 8
        return val

    def parse(self):
        # Magic
        magic = self.read_u4()
        assert magic == 0xCAFEBABE

        # Version
        self.minor = self.read_u2()
        self.major = self.read_u2()

        # Constant pool
        cp_count = self.read_u2()
        i = 1
        while i < cp_count:
            tag = self.read_u1()
            if tag == 1:  # UTF8
                length = self.read_u2()
                s = self.data[self.pos:self.pos+length].decode('utf-8', errors='replace')
                self.pos += length
                self.cp.append(('UTF8', s))
            elif tag == 3:  # Integer
                self.cp.append(('Integer', self.read_i4()))
            elif tag == 4:  # Float
                self.cp.append(('Float', self.read_f4()))
            elif tag == 5:  # Long
                self.cp.append(('Long', self.read_i8()))
                i += 1
                self.cp.append(None)
            elif tag == 6:  # Double
                self.cp.append(('Double', self.read_f8()))
                i += 1
                self.cp.append(None)
            elif tag == 7:  # Class
                self.cp.append(('Class', self.read_u2()))
            elif tag == 8:  # String
                self.cp.append(('String', self.read_u2()))
            elif tag == 9:  # Fieldref
                self.cp.append(('Fieldref', self.read_u2(), self.read_u2()))
            elif tag == 10:  # Methodref
                self.cp.append(('Methodref', self.read_u2(), self.read_u2()))
            elif tag == 11:  # InterfaceMethodref
                self.cp.append(('InterfaceMethodref', self.read_u2(), self.read_u2()))
            elif tag == 12:  # NameAndType
                self.cp.append(('NameAndType', self.read_u2(), self.read_u2()))
            elif tag == 15:  # MethodHandle
                self.cp.append(('MethodHandle', self.read_u1(), self.read_u2()))
            elif tag == 16:  # MethodType
                self.cp.append(('MethodType', self.read_u2()))
            elif tag == 17:  # Dynamic
                self.cp.append(('Dynamic', self.read_u2(), self.read_u2()))
            elif tag == 18:  # InvokeDynamic
                self.cp.append(('InvokeDynamic', self.read_u2(), self.read_u2()))
            elif tag == 19:  # Module
                self.cp.append(('Module', self.read_u2()))
            elif tag == 20:  # Package
                self.cp.append(('Package', self.read_u2()))
            else:
                raise ValueError(f"Unknown constant pool tag {tag} at position {self.pos-1}")
            i += 1

        # Access flags
        self.access_flags = self.read_u2()

        # This class
        this_idx = self.read_u2()
        self.class_name = self.resolve_class_name(this_idx)

        # Super class
        super_idx = self.read_u2()
        if super_idx > 0:
            self.super_name = self.resolve_class_name(super_idx)

        # Interfaces
        iface_count = self.read_u2()
        for _ in range(iface_count):
            idx = self.read_u2()
            self.interfaces.append(self.resolve_class_name(idx))

        # Fields
        fields_count = self.read_u2()
        for _ in range(fields_count):
            facc = self.read_u2()
            fname_idx = self.read_u2()
            fdesc_idx = self.read_u2()
            fname = self.resolve_utf8(fname_idx)
            fdesc = self.resolve_utf8(fdesc_idx)

            # Read field attributes (skip for now)
            fattrs_count = self.read_u2()
            fattr_data = {}
            for _ in range(fattrs_count):
                aname_idx = self.read_u2()
                alen = self.read_u4()
                aname = self.resolve_utf8(aname_idx)
                if aname == 'ConstantValue':
                    cv_idx = self.read_u2()
                    fattr_data['ConstantValue'] = cv_idx
                else:
                    self.pos += alen

            self.fields.append({
                'access': facc,
                'name': fname,
                'descriptor': fdesc,
                'attributes': fattr_data,
            })

        # Methods
        methods_count = self.read_u2()
        for _ in range(methods_count):
            macc = self.read_u2()
            mname_idx = self.read_u2()
            mdesc_idx = self.read_u2()
            mname = self.resolve_utf8(mname_idx)
            mdesc = self.resolve_utf8(mdesc_idx)

            mattrs_count = self.read_u2()
            for _ in range(mattrs_count):
                aname_idx = self.read_u2()
                alen = self.read_u4()
                self.pos += alen

            self.methods.append({
                'access': macc,
                'name': mname,
                'descriptor': mdesc,
            })

    def resolve_utf8(self, idx):
        if idx < 1 or idx >= len(self.cp) or self.cp[idx] is None:
            return f'<unresolved:{idx}>'
        entry = self.cp[idx]
        if entry[0] == 'UTF8':
            return entry[1]
        return f'<not-utf8:{idx}>'

    def resolve_class_name(self, idx):
        if idx < 1 or idx >= len(self.cp) or self.cp[idx] is None:
            return f'<unresolved:{idx}>'
        entry = self.cp[idx]
        if entry[0] == 'Class':
            return self.resolve_utf8(entry[1])
        return f'<not-class:{idx}>'

    def get_string_constants(self):
        """Get all String constants from the constant pool."""
        strings = []
        for entry in self.cp:
            if entry and entry[0] == 'String':
                s = self.resolve_utf8(entry[1])
                strings.append(s)
        return strings

    def get_integer_constants(self):
        """Get all Integer constants."""
        ints = []
        for entry in self.cp:
            if entry and entry[0] == 'Integer':
                ints.append(entry[1])
        return ints

    def get_long_constants(self):
        """Get all Long constants."""
        longs = []
        for entry in self.cp:
            if entry and entry[0] == 'Long':
                longs.append(entry[1])
        return longs

    def get_float_constants(self):
        floats = []
        for entry in self.cp:
            if entry and entry[0] == 'Float':
                floats.append(entry[1])
        return floats

    def get_referenced_classes(self):
        """Get all referenced class names."""
        classes = set()
        for entry in self.cp:
            if entry and entry[0] == 'Class':
                name = self.resolve_utf8(entry[1])
                if not name.startswith('['):  # Skip array types
                    classes.add(name)
        return sorted(classes)

    def get_constant_field_values(self):
        """Get static final field values."""
        results = {}
        for f in self.fields:
            if 'ConstantValue' in f['attributes']:
                cv_idx = f['attributes']['ConstantValue']
                if cv_idx < len(self.cp) and self.cp[cv_idx] is not None:
                    entry = self.cp[cv_idx]
                    if entry[0] in ('Integer', 'Long', 'Float', 'Double'):
                        results[f['name']] = entry[1]
                    elif entry[0] == 'String':
                        results[f['name']] = self.resolve_utf8(entry[1])
        return results

    def is_enum(self):
        return (self.access_flags & 0x4000) != 0

    def is_interface(self):
        return (self.access_flags & 0x0200) != 0

    def is_abstract(self):
        return (self.access_flags & 0x0400) != 0

    def access_str(self):
        parts = []
        if self.access_flags & 0x0001: parts.append('public')
        if self.access_flags & 0x0010: parts.append('final')
        if self.access_flags & 0x0020: parts.append('super')
        if self.access_flags & 0x0200: parts.append('interface')
        if self.access_flags & 0x0400: parts.append('abstract')
        if self.access_flags & 0x1000: parts.append('synthetic')
        if self.access_flags & 0x2000: parts.append('annotation')
        if self.access_flags & 0x4000: parts.append('enum')
        if self.access_flags & 0x8000: parts.append('module')
        return ' '.join(parts)

    def method_access_str(self, acc):
        parts = []
        if acc & 0x0001: parts.append('public')
        if acc & 0x0002: parts.append('private')
        if acc & 0x0004: parts.append('protected')
        if acc & 0x0008: parts.append('static')
        if acc & 0x0010: parts.append('final')
        if acc & 0x0040: parts.append('bridge')
        if acc & 0x0080: parts.append('varargs')
        if acc & 0x0100: parts.append('native')
        if acc & 0x0400: parts.append('abstract')
        return ' '.join(parts)

    def field_access_str(self, acc):
        parts = []
        if acc & 0x0001: parts.append('public')
        if acc & 0x0002: parts.append('private')
        if acc & 0x0004: parts.append('protected')
        if acc & 0x0008: parts.append('static')
        if acc & 0x0010: parts.append('final')
        if acc & 0x0040: parts.append('volatile')
        if acc & 0x0080: parts.append('transient')
        if acc & 0x1000: parts.append('synthetic')
        if acc & 0x4000: parts.append('enum')
        return ' '.join(parts)


def format_descriptor(desc):
    """Convert Java type descriptor to human-readable form."""
    mapping = {
        'B': 'byte', 'C': 'char', 'D': 'double', 'F': 'float',
        'I': 'int', 'J': 'long', 'S': 'short', 'Z': 'boolean', 'V': 'void'
    }
    if desc in mapping:
        return mapping[desc]
    if desc.startswith('['):
        return format_descriptor(desc[1:]) + '[]'
    if desc.startswith('L') and desc.endswith(';'):
        return desc[1:-1].replace('/', '.')
    return desc


def format_method_desc(desc):
    """Convert method descriptor to human-readable form."""
    # Parse (params)return
    if not desc.startswith('('):
        return desc
    close = desc.index(')')
    params_str = desc[1:close]
    ret_str = desc[close+1:]

    params = []
    i = 0
    while i < len(params_str):
        if params_str[i] in 'BCDFIJSZV':
            params.append(format_descriptor(params_str[i]))
            i += 1
        elif params_str[i] == '[':
            j = i
            while params_str[j] == '[':
                j += 1
            if params_str[j] == 'L':
                end = params_str.index(';', j)
                params.append(format_descriptor(params_str[i:end+1]))
                i = end + 1
            else:
                params.append(format_descriptor(params_str[i:j+1]))
                i = j + 1
        elif params_str[i] == 'L':
            end = params_str.index(';', i)
            params.append(format_descriptor(params_str[i:end+1]))
            i = end + 1
        else:
            i += 1

    ret = format_descriptor(ret_str)
    return f"({', '.join(params)}) -> {ret}"


def analyze_all(base_dir, output_file):
    """Analyze all class files in the given directory."""
    class_files = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            if f.endswith('.class'):
                class_files.append(os.path.join(root, f))

    analyzers = {}
    for cf in sorted(class_files):
        try:
            a = JavaClassAnalyzer(cf)
            analyzers[a.class_name] = a
        except Exception as e:
            print(f"Error analyzing {cf}: {e}")

    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("=" * 80 + "\n")
        out.write("AoE4 Replay Parser - Class Analysis Report\n")
        out.write("Source: ch.iddqd.aoe4.parser@0.9.7-SNAPSHOT\n")
        out.write("=" * 80 + "\n\n")

        # Group classes by package
        packages = defaultdict(list)
        for name, a in analyzers.items():
            pkg = name.rsplit('/', 1)[0] if '/' in name else ''
            packages[pkg].append(a)

        # ================================================================
        # 1. ARCHITECTURE OVERVIEW
        # ================================================================
        out.write("=" * 80 + "\n")
        out.write("1. ARCHITECTURE OVERVIEW\n")
        out.write("=" * 80 + "\n\n")

        out.write("Packages:\n")
        for pkg in sorted(packages.keys()):
            classes = packages[pkg]
            out.write(f"  {pkg.replace('/', '.')} ({len(classes)} classes)\n")

        out.write("\n\nClass Hierarchy:\n")
        for name, a in sorted(analyzers.items()):
            kind = 'enum' if a.is_enum() else 'interface' if a.is_interface() else 'abstract class' if a.is_abstract() else 'class'
            super_short = a.super_name.split('/')[-1] if a.super_name else ''
            ifaces = ', '.join(i.split('/')[-1] for i in a.interfaces) if a.interfaces else ''
            short_name = name.split('/')[-1]
            out.write(f"  {kind} {short_name}")
            if super_short and super_short != 'Object' and super_short != 'Enum':
                out.write(f" extends {super_short}")
            if ifaces:
                out.write(f" implements {ifaces}")
            out.write("\n")

        # ================================================================
        # 2. COMMAND TYPE MAPPINGS
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("2. COMMAND TYPE MAPPINGS\n")
        out.write("=" * 80 + "\n\n")

        # Look for CommandType enum
        for name, a in analyzers.items():
            if 'CommandType' in name and a.is_enum():
                out.write(f"Enum: {name.replace('/', '.')}\n")
                for f in a.fields:
                    if f['access'] & 0x4000:  # enum constant
                        out.write(f"  {f['name']}\n")
                out.write("\n")
                # Show string constants that might be command type names
                strings = a.get_string_constants()
                if strings:
                    out.write(f"  String constants:\n")
                    for s in strings:
                        out.write(f"    \"{s}\"\n")
                out.write("\n")

        # Look for ParserProvider which maps command types to parsers
        for name, a in analyzers.items():
            if 'ParserProvider' in name:
                out.write(f"\nParserProvider: {name.replace('/', '.')}\n")
                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] != '<init>' and m['name'] != '<clinit>':
                        out.write(f"    {a.method_access_str(m['access'])} {m['name']}{format_method_desc(m['descriptor'])}\n")
                strings = a.get_string_constants()
                ints = a.get_integer_constants()
                if ints:
                    out.write(f"  Integer constants (possible command type IDs): {ints}\n")
                if strings:
                    out.write(f"  String constants:\n")
                    for s in strings:
                        out.write(f"    \"{s}\"\n")

        # ================================================================
        # 3. ENTITY TYPE DEFINITIONS
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("3. ENTITY/BUILDING/UNIT TYPE DEFINITIONS\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['EntityType', 'BuildingType', 'UnitType', 'EntityDirectory',
                                        'EntityEntry', 'GaiaType', 'ResourceType']):
                short = name.split('/')[-1]
                out.write(f"\n--- {short} ---\n")
                out.write(f"  Full name: {name.replace('/', '.')}\n")

                if a.is_enum():
                    out.write(f"  Type: enum\n")
                    enum_fields = [f for f in a.fields if f['access'] & 0x4000]
                    out.write(f"  Enum constants ({len(enum_fields)}):\n")
                    for f in enum_fields:
                        out.write(f"    {f['name']}\n")

                out.write(f"  Fields:\n")
                for f in a.fields:
                    if not (f['access'] & 0x4000):  # skip enum constants
                        acc = a.field_access_str(f['access'])
                        out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] not in ('<init>', '<clinit>', 'values', 'valueOf'):
                        acc = a.method_access_str(m['access'])
                        out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

                # Show constant values
                cv = a.get_constant_field_values()
                if cv:
                    out.write(f"  Constant values:\n")
                    for k, v in cv.items():
                        out.write(f"    {k} = {v}\n")

                # String constants (entity names, IDs)
                strings = a.get_string_constants()
                if strings and len(strings) <= 50:
                    out.write(f"  String constants ({len(strings)}):\n")
                    for s in strings:
                        out.write(f"    \"{s}\"\n")
                elif strings:
                    out.write(f"  String constants: {len(strings)} total (first 30):\n")
                    for s in strings[:30]:
                        out.write(f"    \"{s}\"\n")
                    out.write(f"    ... and {len(strings)-30} more\n")

                # Integer constants (type IDs)
                ints = a.get_integer_constants()
                if ints:
                    out.write(f"  Integer constants ({len(ints)}): {ints[:50]}\n")

        # ================================================================
        # 4. REPLAY PARSER - Main parsing logic
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("4. REPLAY PARSER - Main Parsing Logic\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['ReplayParser', 'Replay', 'HeaderParser', 'CommandParser',
                                        'MessageParser', 'MapParser', 'PlayerParser', 'SettingParser']):
                short = name.split('/')[-1]
                out.write(f"\n--- {short} ---\n")
                out.write(f"  Full name: {name.replace('/', '.')}\n")
                if a.super_name:
                    out.write(f"  Extends: {a.super_name.replace('/', '.')}\n")
                if a.interfaces:
                    out.write(f"  Implements: {', '.join(i.replace('/', '.') for i in a.interfaces)}\n")

                out.write(f"  Fields:\n")
                for f in a.fields:
                    acc = a.field_access_str(f['access'])
                    out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] not in ('<clinit>',):
                        acc = a.method_access_str(m['access'])
                        out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

                ints = a.get_integer_constants()
                if ints:
                    out.write(f"  Integer constants: {ints}\n")

                strings = a.get_string_constants()
                if strings:
                    out.write(f"  String constants ({len(strings)}):\n")
                    for s in strings[:50]:
                        out.write(f"    \"{s}\"\n")
                    if len(strings) > 50:
                        out.write(f"    ... and {len(strings)-50} more\n")

        # ================================================================
        # 5. DATA STRUCTURES
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("5. DATA STRUCTURES (Command Types, Coordinates, etc.)\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['Command', 'Coordinates', 'Building', 'Unit', 'Entity',
                                        'Resource', 'SubCommand']):
                if 'Parser' in name or 'Filter' in name or 'Type' in name:
                    continue
                short = name.split('/')[-1]
                out.write(f"\n--- {short} ---\n")
                out.write(f"  Full name: {name.replace('/', '.')}\n")
                if a.super_name and 'Object' not in a.super_name:
                    out.write(f"  Extends: {a.super_name.split('/')[-1]}\n")
                if a.interfaces:
                    out.write(f"  Implements: {', '.join(i.split('/')[-1] for i in a.interfaces)}\n")

                out.write(f"  Fields:\n")
                for f in a.fields:
                    acc = a.field_access_str(f['access'])
                    out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] not in ('<clinit>', '<init>', 'values', 'valueOf',
                                         'toString', 'hashCode', 'equals'):
                        acc = a.method_access_str(m['access'])
                        out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

                strings = a.get_string_constants()
                if strings and len(strings) <= 20:
                    out.write(f"  String constants: {strings}\n")

        # ================================================================
        # 6. UTILITY CLASSES (LEDataInputStream, Printers)
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("6. UTILITY CLASSES\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['LEData', 'Printer', 'Logger', 'GameLog', 'ApmGraph']):
                short = name.split('/')[-1]
                out.write(f"\n--- {short} ---\n")
                out.write(f"  Full name: {name.replace('/', '.')}\n")

                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] not in ('<clinit>', '<init>'):
                        acc = a.method_access_str(m['access'])
                        out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

        # ================================================================
        # 7. GENERATED TYPE ENUMS (Entity ID Mappings)
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("7. GENERATED TYPE ENUMS (Entity ID Mappings)\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if 'GeneratedType' in name and a.is_enum():
                short = name.split('/')[-1]
                enum_fields = [f for f in a.fields if f['access'] & 0x4000]
                out.write(f"\n--- {short} ({len(enum_fields)} entries) ---\n")

                # Show first 50 enum constants
                for f in enum_fields[:50]:
                    out.write(f"  {f['name']}\n")
                if len(enum_fields) > 50:
                    out.write(f"  ... and {len(enum_fields)-50} more\n")

                # Show non-enum fields (which might include ID mappings)
                non_enum_fields = [f for f in a.fields if not (f['access'] & 0x4000)]
                if non_enum_fields:
                    out.write(f"  Non-enum fields:\n")
                    for f in non_enum_fields:
                        acc = a.field_access_str(f['access'])
                        out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                # Integer constants are the actual type IDs
                ints = a.get_integer_constants()
                if ints:
                    out.write(f"  Integer constants ({len(ints)} values, first 50): {ints[:50]}\n")

                strings = a.get_string_constants()
                if strings:
                    out.write(f"  String constants ({len(strings)}, first 20): {strings[:20]}\n")

        # ================================================================
        # 8. TRANSLATIONS & MAP INFO
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("8. TRANSLATIONS, MAP INFO & GAME LOG\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['Translations', 'MapInfo', 'MapInitializer',
                                        'GameLog', 'Actions', 'Age']):
                short = name.split('/')[-1]
                out.write(f"\n--- {short} ---\n")
                out.write(f"  Full name: {name.replace('/', '.')}\n")

                if a.is_enum():
                    enum_fields = [f for f in a.fields if f['access'] & 0x4000]
                    out.write(f"  Enum constants: {[f['name'] for f in enum_fields]}\n")

                non_enum_fields = [f for f in a.fields if not (f['access'] & 0x4000)]
                if non_enum_fields:
                    out.write(f"  Fields:\n")
                    for f in non_enum_fields:
                        acc = a.field_access_str(f['access'])
                        out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                out.write(f"  Methods:\n")
                for m in a.methods:
                    if m['name'] not in ('<clinit>', '<init>', 'values', 'valueOf'):
                        acc = a.method_access_str(m['access'])
                        out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

                strings = a.get_string_constants()
                if strings and len(strings) <= 30:
                    out.write(f"  String constants: {strings}\n")
                elif strings:
                    out.write(f"  String constants ({len(strings)}, first 30): {strings[:30]}\n")

        # ================================================================
        # 9. HEADER / INFO STRUCTURES
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("9. HEADER & INFO STRUCTURES\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            if any(x in name for x in ['Header', 'Player', 'Setting', 'Color', 'CustomMap',
                                        'Map']) and 'Parser' not in name and 'Type' not in name:
                if name in analyzers and not any(x in name for x in ['Command']):
                    short = name.split('/')[-1]
                    out.write(f"\n--- {short} ---\n")
                    out.write(f"  Full name: {name.replace('/', '.')}\n")

                    out.write(f"  Fields:\n")
                    for f in a.fields:
                        acc = a.field_access_str(f['access'])
                        out.write(f"    {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

                    out.write(f"  Methods:\n")
                    for m in a.methods:
                        if m['name'] not in ('<clinit>',):
                            acc = a.method_access_str(m['access'])
                            out.write(f"    {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

                    cv = a.get_constant_field_values()
                    if cv:
                        out.write(f"  Constant values: {cv}\n")

                    strings = a.get_string_constants()
                    if strings:
                        out.write(f"  String constants: {strings[:30]}\n")

        # ================================================================
        # 10. COMPLETE CLASS LISTING
        # ================================================================
        out.write("\n\n" + "=" * 80 + "\n")
        out.write("10. COMPLETE CLASS LISTING WITH SIGNATURES\n")
        out.write("=" * 80 + "\n\n")

        for name, a in sorted(analyzers.items()):
            short = name.split('/')[-1]
            kind = 'enum' if a.is_enum() else 'interface' if a.is_interface() else 'abstract class' if a.is_abstract() else 'class'
            out.write(f"\n{kind} {name.replace('/', '.')}\n")
            if a.super_name and 'Object' not in a.super_name and 'Enum' not in a.super_name:
                out.write(f"  extends {a.super_name.replace('/', '.')}\n")
            for iface in a.interfaces:
                out.write(f"  implements {iface.replace('/', '.')}\n")

            for f in a.fields:
                if not (f['access'] & 0x4000 and a.is_enum()):  # skip enum constants in listing
                    acc = a.field_access_str(f['access'])
                    out.write(f"  {acc} {format_descriptor(f['descriptor'])} {f['name']}\n")

            for m in a.methods:
                if m['name'] not in ('<clinit>', 'values', 'valueOf'):
                    acc = a.method_access_str(m['access'])
                    out.write(f"  {acc} {m['name']}{format_method_desc(m['descriptor'])}\n")

    print(f"Analysis written to: {output_file}")


def main():
    base_dir = "C:/Users/fermi/aoe4-replay-viewer/tools/aoe4analyzer/extracted/ch.iddqd.aoe4.parser"
    output_file = "C:/Users/fermi/aoe4-replay-viewer/tools/parser_analysis.txt"

    analyze_all(base_dir, output_file)


if __name__ == '__main__':
    main()
