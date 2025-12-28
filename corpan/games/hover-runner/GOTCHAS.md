# Babylon.js Gotchas - Hover Runner Development

## CRITICAL: Particles Need Textures
**Problem**: Setting `particleTexture = null` makes particles COMPLETELY INVISIBLE
**Solution**: Always create a texture, even a simple procedural one:
```typescript
const particleTexture = new Texture('data:image/svg+xml;base64,' + btoa(`
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
    <circle cx="16" cy="16" r="15" fill="white"/>
  </svg>
`), scene)
particleSystem.particleTexture = particleTexture
```

## CRITICAL: Parent Hierarchy Can Break Silently
**Problem**: Meshes parented to transforms had `localPosition === worldPosition`, causing drawCalls = 0
**Solution**: Position meshes in world space directly without parents, update positions each frame
**Evidence**: Spent 5+ hours debugging invisible geometries that were "enabled" but not rendering

## Progression System Must Check for Changes
**Problem**: Calling `configureGeometries()` every frame (60 FPS) reset geometries before rendering
**Solution**: Only reconfigure when progression values actually change:
```typescript
if (currentLevel !== lastProgressionLevel || netCorrect !== lastProgressionNetCorrect) {
  // reconfigure
}
```

## iOS-Specific Timing Issues
**Problem**: TTS repeat timing needs different values on iOS
**Solution**: Detect iOS and use platform-specific constants:
```typescript
speakRepeatMs: isIOS() ? TIMING.speakRepeatMsIOS : TIMING.speakRepeatMs
```

## Frustum Culling Can Hide Visible Meshes
**Problem**: Meshes with broken bounding boxes get culled even when visible
**Solution**: Force meshes to always render:
```typescript
mesh.alwaysSelectAsActiveMesh = true
```

## Particle Emitters Don't Auto-Update Position
**Problem**: Setting `emitter = mesh` at creation doesn't follow mesh movement
**Solution**: Use Vector3 emitter and update position every frame:
```typescript
particleSystem.emitter = new Vector3(0, 0, 0)
// In update loop:
if (particleSystem.emitter instanceof Vector3) {
  particleSystem.emitter.set(worldX, worldY, worldZ)
}
```

## Performance Tips
- Freeze materials after setup: `material.freeze()`
- Use object pooling instead of create/destroy
- Limit particle counts (30-100 per system max)
- Disable backface culling only when needed
- Use additive blend mode for glow effects: `ParticleSystem.BLENDMODE_ADD`
