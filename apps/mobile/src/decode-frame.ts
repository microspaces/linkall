import jpeg from "jpeg-js";
import * as ImageManipulator from "expo-image-manipulator";
import {
  computeP2Warp,
  detectDualMarkers,
  type Mat3,
} from "@linkall/backend/dual-calib";

function base64ToBytes(b64: string): Uint8Array {
  const raw = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = globalThis.atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Resize a still, decode JPEG pixels, find the 8 markers, return the
 * normalized P2→P1 homography.
 */
export async function warpFromPhoto(
  uri: string,
  fallbackBase64?: string,
): Promise<{ matrix: Mat3; imageWidth: number; imageHeight: number }> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 960 } }],
    {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  const b64 = resized.base64 ?? fallbackBase64;
  if (!b64) throw new Error("Could not read photo pixels");
  const decoded = jpeg.decode(base64ToBytes(b64), { useTArray: true });
  const found = detectDualMarkers({
    data: decoded.data,
    width: decoded.width,
    height: decoded.height,
  });
  return {
    matrix: computeP2Warp(found.p1, found.p2),
    imageWidth: decoded.width,
    imageHeight: decoded.height,
  };
}
