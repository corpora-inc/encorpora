"""Read a geometry scene as the plain figure data its component draws.

Geometry problems carry `{kind: "scene"}` figures built from one component
(shapes, shapePuzzle, solid, isoSolid, or a first-quadrant graph). The
oracles reason about the drawn data itself: vertices, edges, plotted points.
This reads that data back out of the scene; it computes nothing.
"""


def figure_view(figure):
    if figure is None or figure.get('kind') != 'scene':
        return figure
    elements = figure['scene']['elements']
    for e in elements:
        t = e['type']
        if t == 'shapes':
            return {'kind': 'plane-shapes', 'items': e['items']}
        if t == 'shapePuzzle':
            return {'kind': 'shape-puzzle', 'outline': e['outline'], 'placed': e['placed'], 'candidates': e['candidates']}
        if t == 'solid':
            return {'kind': 'solid-shape', 'solid': e['solid']}
        if t == 'isoSolid':
            s = e['solid']
            if s['form'] == 'cubes':
                return {'kind': 'cube-prism', 'length': s['length'], 'width': s['width'], 'height': s['height']}
            if s['form'] == 'box':
                return {'kind': 'box-prism', 'length': s['length'], 'width': s['width'], 'height': s['height']}
            return {'kind': 'composite-prism', 'width': s['width'], 'parts': s['parts'], 'unit': s['unit']}
        if t == 'graph' and e['x'][0] == 0 and e['y'][0] == 0 and e['x'][1] == e['y'][1]:
            return {'kind': 'quadrant-grid', 'size': e['x'][1],
                    'points': [{'x': p['x'], 'y': p['y'], 'label': p['label']} for p in e.get('points', [])]}
    return figure
