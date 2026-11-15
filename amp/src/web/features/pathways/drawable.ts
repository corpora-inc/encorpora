let answer: boolean | undefined;

/**
 * Whether this browser can draw the 3D map: three.js draws with WebGL 2 and
 * nothing less. Asked once per page, before the map mounts, so a browser
 * without it never shows a canvas or its controls (it gets the flat
 * pathway). A context lost later is the map's own to report.
 */
export function canDrawMap(): boolean {
  if (answer !== undefined) return answer;
  answer = false;
  if (typeof WebGL2RenderingContext === "undefined") return answer;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    answer = !!gl;
    // The probe's context is let go at once: the map makes its own.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch (error) {
    console.warn(
      "The 3D map can't be drawn here; showing the flat pathway.",
      error,
    );
  }
  return answer;
}
