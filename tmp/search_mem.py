import re
import sys

def search_memory(pid, search_str):
    try:
        maps_file = open(f"/proc/{pid}/maps", 'r')
        mem_file = open(f"/proc/{pid}/mem", 'rb')
    except IOError as e:
        print(f"Can't open file: {e}")
        return

    pattern = re.compile(search_str.encode('utf-8'), re.IGNORECASE)

    for line in maps_file:
        parts = line.split()
        if len(parts) < 2:
            continue
        addr_range = parts[0]
        perms = parts[1]
        
        # We only want readable regions
        if 'r' not in perms:
            continue
            
        # Skip some file mappings that are clearly libraries
        if len(parts) > 5:
            path = parts[5]
            if path.startswith('/usr') or path.startswith('/lib') or path.startswith('/sys') or path.startswith('/dev'):
                continue

        start_hex, end_hex = addr_range.split('-')
        start = int(start_hex, 16)
        end = int(end_hex, 16)
        size = end - start

        try:
            mem_file.seek(start)
            data = mem_file.read(size)
            for match in pattern.finditer(data):
                match_pos = match.start()
                # Print some context around the match
                context_start = max(0, match_pos - 100)
                context_end = min(size, match_pos + 100)
                context = data[context_start:context_end]
                # Replace non-printable characters
                context_clean = ''.join(chr(c) if 32 <= c < 127 else '.' for c in context)
                print(f"Match found at hex address {hex(start + match_pos)}:")
                print(f"Context: {context_clean}")
                print("-" * 50)
        except Exception as e:
            # Some memory regions cannot be read even if mapped 'r'
            pass

    maps_file.close()
    mem_file.close()

if __name__ == '__main__':
    pid = sys.argv[1]
    search_str = sys.argv[2]
    print(f"Searching memory of PID {pid} for '{search_str}'...")
    search_memory(pid, search_str)
