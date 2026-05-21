# Avatar model

Drop the rigged avatar here as **`aria.glb`**:

```
frontend/public/models/aria.glb
```

`ConciergeAvatar` loads `/models/aria.glb` automatically. Until the file
exists, an animated placeholder figure is shown — the app still builds and
runs.

## Producing a `.glb`

The fastest no-cost route is **Ready Player Me**:

1. Create an avatar at <https://readyplayer.me> and copy its `.glb` URL.
2. Append `?meshLod=1` for a lighter web mesh, then download it.
3. Save it here as `aria.glb`.

Other options: an image-to-3D tool (Meshy, Rodin, Tripo) or a 3D artist.

## Animation clips

`AvatarModel.tsx` maps conversational states to clip names:

| State       | Clip name |
| ----------- | --------- |
| `idle`      | `Idle`    |
| `listening` | `Idle`    |
| `thinking`  | `Thinking`|
| `speaking`  | `Talking` |

If your `.glb`'s clips are named differently, either rename them in Blender
or update `STATE_TO_CLIP` in `AvatarModel.tsx`. Inspect a model's clip names
at <https://gltf.report>.

## Keep it light

Aim for **< 5 MB**. Run it through <https://gltf.report> or `gltf-transform`
to compress textures and apply Draco mesh compression before committing.
