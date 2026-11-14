import json
from pathlib import Path
detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
for cat, files in detect['files'].items():
    print(f'{cat}: {len(files)} files')
print(f'Total: {detect["total_files"]} files, ~{detect["total_words"]} words')