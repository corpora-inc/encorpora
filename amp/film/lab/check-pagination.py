"""Offline encoder integration check; run through the heavy-command wrapper."""
import json
from pathlib import Path
import subprocess
import tempfile

from runtime import pages


with tempfile.TemporaryDirectory(prefix='film-lab-pagination-') as temporary:
    root = Path(temporary)
    results = []
    for name, size, count, tall, expected in (
        ('wide', '1920x1080', 5, False, 2), ('tall', '1080x1920', 3, True, 2),
    ):
        raw = root/name
        raw.mkdir()
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size='+size,
                        '-frames:v', str(count), '-start_number', '0', '-q:v', '3', str(raw/'%03d.jpg')],
                       check=True, capture_output=True)
        output = pages(raw, root/'pages', name, tall)
        assert len(output)==expected, 'The final partial page was dropped'
        dimensions = []
        for image in output:
            result = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height', '-of', 'json', image],
                check=True, capture_output=True, text=True)
            value = json.loads(result.stdout)['streams'][0]
            assert 0 < value['width'] <= 2000 and 0 < value['height'] <= 2000
            dimensions.append(value)
        results.append({'layout': name, 'source_frames': count, 'pages': len(output), 'dimensions': dimensions})
    print(json.dumps({'passed': True, 'results': results}))
