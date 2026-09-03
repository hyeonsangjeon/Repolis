# Procedural Surface Pass v2

Issue [#114](https://github.com/hyeonsangjeon/Repolis/issues/114) improves the existing facade and roof
families without adding fetched textures, binary assets, models, dependencies, build steps, scene lights,
colliders, timers, or render passes.

## Runtime contract

- `assets/procedural-surfaces.js` owns the pure seed, UV phase, repeat scale, fixed family list, and cache helpers.
- The runtime owns one neutral `CanvasTexture` for each of brick, siding, panel, stone, stucco, timber,
  board-and-batten, metal, and shingle. Existing wall/roof colors, including wear and ruin tints, remain material
  colors.
- Each house gets deterministic geometry UV scale, offset, and mirroring. Houses do not get a full-resolution
  texture clone.
- Main-body night warmth is quantized to low / medium / high activity in the material key; meshes share a material
  only when their facade map, palette color, and emissive level match.
- The texture cache is a fixed nine-entry keyspace on desktop and LOW_END. The shared material pool
  is bounded at 384 entries, covering three pooled keys for every supported 100-repository town plus headroom.
  Overflow throws instead of growing silently.
- Canvas maps are sRGB, repeat-wrapped, mipmapped, trilinear-minified, linear-magnified, and use anisotropy 8
  desktop / 4 LOW_END at most.
- Context restoration marks every pooled texture for upload. A non-bfcache page exit disposes both pools.
- No bump, normal, or roughness channel shipped: the color/relief pass met the visual goal without another
  texture, shader variant, or mobile cost.

The old per-mesh `Texture.clone()` also allocated a `Texture` UUID and a `Source` UUID from `Math.random`.
The new pool preserves those two initialization-time UUID draws without creating a texture, so unrelated
procedural scenery remains byte-for-byte on the same seeded fixture.

## Reproducible evidence

Measured locally in Chrome 152 on the same Mac and browser process. Both `origin/main` and the feature were
served from immutable local directories. The fixture fixed `Math.random` to seed `123456789`, cleared storage,
loaded `?dbg=1`, forced `full` on desktop and the LOW_END `balanced` ceiling on mobile, and walked from
`(15,-7)` at yaw `pi` with `KeyW` for eight seconds. The first route was discarded; the next 300 active frames
formed the warm sample.

The seeded scene contract matched exactly before timing: LOD-init RNG count and full-group draw sum were
`190,385 / 4,438` on desktop and `168,755 / 4,293` on 390x844 LOW_END for both versions.

| Fixture | Warm render p95 before | After | Regression |
|---|---:|---:|---:|
| Desktop day | 7.0 ms | 7.0 ms | 0.0% |
| Desktop night | 11.5 ms | 9.7 ms | -15.7% |
| 390x844 LOW_END day | 6.5 ms | 6.3 ms | -3.1% |
| 390x844 LOW_END night | 8.9 ms | 8.3 ms | -6.7% |

| Fixture | Calls p95 before | After | Live GPU textures before | After | Programs |
|---|---:|---:|---:|---:|---:|
| Desktop day | 1337 | 1336 | 185 | 155 | 100 -> 98 |
| Desktop night | 1515 | 1401 | 185 | 155 | 100 -> 98 |
| 390x844 LOW_END day | 546 | 545 | 136 | 124 | 97 -> 95 |
| 390x844 LOW_END night | 567 | 579 | 136 | 124 | 97 -> 95 |

The pass adds no mesh or render pass, and the seeded full-group draw sum is exact, so its owned draw-call delta
is zero. The dynamic mobile-night p95 sample varied by 12 calls as existing LOD/night effects settled; it is
reported rather than treated as a new feature draw. Desktop textures decreased by 30 and LOW_END by 12, both
below their respective `+8` and `+0` ceilings.

`window.__proceduralSurfaces()` recorded all eight facade families plus shingle with nonzero pixel ranges,
stable hashes across day/night and reload, and cache sizes at or below 9. `WEBGL_lose_context` recovery retained
the same hashes and cache size while incrementing the restore counter. `window.__canvasPixels()` reported a
fully framed canvas with no horizontal overflow and 99.933% / 98.962% nonblank pixels on mobile / desktop.
Desktop and mobile day/night captures were kept as local session evidence, not committed.
