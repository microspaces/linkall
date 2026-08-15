import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import type { Id } from "@linkall/backend/convex/_generated/dataModel";
import { P1_COLOR, P2_COLOR } from "@linkall/backend/dual-calib";
import { brand } from "../src/brand";
import { warpFromPhoto } from "../src/decode-frame";

type Step = "pick" | "capture" | "detecting" | "done" | "error";

export default function CalibrateScreen() {
  const layouts = useQuery(api.designer.listLayouts);
  const [layoutId, setLayoutId] = useState<Id<"layouts"> | null>(null);
  const layoutDoc =
    layouts?.find((l) => l._id === layoutId) ?? layouts?.[0] ?? null;
  const layout = useQuery(
    api.designer.getLayout,
    layoutDoc ? { layoutId: layoutDoc._id } : "skip",
  );
  const screens = layout?.screens ?? [];

  const [p1Id, setP1Id] = useState<Id<"screens"> | null>(null);
  const [p2Id, setP2Id] = useState<Id<"screens"> | null>(null);
  const p1 = screens.find((s) => s._id === p1Id) ?? screens[0] ?? null;
  const p2 =
    screens.find((s) => s._id === p2Id && s._id !== p1?._id) ??
    screens.find((s) => s._id !== p1?._id) ??
    null;

  const warp = useQuery(
    api.designer.getScreenWarp,
    p2 ? { screenId: p2._id } : "skip",
  );

  const setMarkers = useMutation(api.designer.setDualCalibMarkers);
  const hideMarkers = useMutation(api.designer.clearDualCalibMarkers);
  const saveWarp = useMutation(api.designer.saveScreenWarp);
  const clearWarp = useMutation(api.designer.clearScreenWarp);

  const [step, setStep] = useState<Step>("pick");
  const [message, setMessage] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const p2Ref = useRef(p2);
  p2Ref.current = p2;

  useEffect(() => {
    return () => {
      const id = p2Ref.current?._id;
      if (id) void hideMarkers({ p2ScreenId: id });
    };
  }, [hideMarkers]);

  const startCalibrate = async () => {
    if (!p1 || !p2) {
      setMessage("This layout needs two screens (one per projector).");
      return;
    }
    setMessage(null);
    try {
      await setMarkers({ p1ScreenId: p1._id, p2ScreenId: p2._id });
      setStep("capture");
    } catch (err) {
      setStep("error");
      setMessage(err instanceof Error ? err.message : "Could not show markers");
    }
  };

  const capture = async () => {
    if (!p1 || !p2) return;
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.5,
        base64: true,
        shutterSound: false,
      });
      if (!photo?.uri) throw new Error("Camera did not return a photo");
      setStep("detecting");
      setMessage("Detecting the 8 corner markers…");
      const result = await warpFromPhoto(photo.uri, photo.base64);
      await saveWarp({
        screenId: p2._id,
        referenceScreenId: p1._id,
        matrix: [...result.matrix],
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
      });
      setStep("done");
      setMessage("Aligned. Projector 2 is now pre-warped to Projector 1.");
    } catch (err) {
      setStep("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Detection failed — reframe so all 8 markers are visible",
      );
      try {
        await hideMarkers({ p2ScreenId: p2._id });
      } catch {
        /* ignore */
      }
    }
  };

  const cancelCapture = async () => {
    if (p2) {
      try {
        await hideMarkers({ p2ScreenId: p2._id });
      } catch {
        /* ignore */
      }
    }
    setStep("pick");
    setMessage(null);
  };

  const clearAlignment = async () => {
    if (!p2) return;
    try {
      await clearWarp({ screenId: p2._id });
      setMessage("Alignment cleared. Projector 2 is unwarped.");
      setStep("pick");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not clear warp");
    }
  };

  if (!brand.features.shows) {
    return (
      <View style={styles.center}>
        <Text style={styles.body}>
          Dual-projector calibration is part of the show engine.
        </Text>
      </View>
    );
  }

  if (layouts === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.colors.primary} />
      </View>
    );
  }

  if (step === "capture" || step === "detecting") {
    return (
      <View style={styles.cameraWrap}>
        {permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.body}>Camera access is required to capture the markers.</Text>
            <Pressable
              style={styles.primary}
              onPress={() => void requestPermission()}
            >
              <Text style={styles.primaryText}>Allow camera</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.cameraHud}>
          <Text style={styles.hudTitle}>
            Point at the house so all 8 markers are visible
          </Text>
          <Text style={styles.hudBody}>
            Cyan = Projector 1 · Magenta = Projector 2
          </Text>
          {step === "detecting" ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.hudBody}>{message}</Text>
            </View>
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.ghost} onPress={() => void cancelCapture()}>
                <Text style={styles.ghostText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, { flex: 1, marginTop: 0 }]}
                onPress={() => void capture()}
                disabled={!permission?.granted}
              >
                <Text style={styles.primaryText}>Capture</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  const cabinetReady = screens.length >= 2;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Calibrate Dual Projectors</Text>
      <Text style={styles.body}>
        Stack two projectors for brightness. Capture both marker sets with the
        phone camera; Projector 2 is then pre-warped onto Projector 1. Panel
        dragging keeps working for both.
      </Text>

      {layouts.length > 1 && (
        <View style={styles.block}>
          <Text style={styles.label}>Layout</Text>
          {layouts.map((l) => (
            <Pressable
              key={l._id}
              style={[
                styles.choice,
                layoutDoc?._id === l._id && styles.choiceOn,
              ]}
              onPress={() => {
                setLayoutId(l._id);
                setP1Id(null);
                setP2Id(null);
              }}
            >
              <Text style={styles.choiceText}>{l.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {!cabinetReady ? (
        <Text style={styles.warn}>
          {layoutDoc
            ? `“${layoutDoc.name}” needs two screens (one Google TV output each).`
            : "Create a layout with two screens in the Designer first."}
        </Text>
      ) : (
        <>
          <View style={styles.block}>
            <Text style={styles.label}>Projector 1 — reference</Text>
            <Text style={styles.hint}>Shows cyan corner markers</Text>
            {screens.map((s) => (
              <Pressable
                key={s._id}
                style={[styles.choice, p1?._id === s._id && styles.choiceOn]}
                onPress={() => {
                  setP1Id(s._id);
                  if (p2Id === s._id) setP2Id(null);
                }}
              >
                <View style={[styles.swatch, { backgroundColor: P1_COLOR }]} />
                <Text style={styles.choiceText}>
                  {s.name} · {s.width}×{s.height}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.block}>
            <Text style={styles.label}>Projector 2 — warped</Text>
            <Text style={styles.hint}>Shows magenta corner markers</Text>
            {screens
              .filter((s) => s._id !== p1?._id)
              .map((s) => (
                <Pressable
                  key={s._id}
                  style={[styles.choice, p2?._id === s._id && styles.choiceOn]}
                  onPress={() => setP2Id(s._id)}
                >
                  <View style={[styles.swatch, { backgroundColor: P2_COLOR }]} />
                  <Text style={styles.choiceText}>
                    {s.name} · {s.width}×{s.height}
                  </Text>
                </Pressable>
              ))}
          </View>

          <View style={styles.status}>
            <Text style={styles.statusText}>
              {warp?.matrix && warp.matrix.length === 9
                ? `Warp saved${
                    warp.capturedAt
                      ? ` ${new Date(warp.capturedAt).toLocaleString()}`
                      : ""
                  }`
                : "No warp stored yet"}
            </Text>
          </View>
        </>
      )}

      {message && (
        <Text style={step === "error" ? styles.error : styles.ok}>{message}</Text>
      )}

      <Pressable
        style={[styles.primary, !cabinetReady && styles.disabled]}
        disabled={!cabinetReady}
        onPress={() => void startCalibrate()}
      >
        <Text style={styles.primaryText}>
          {step === "done" || (warp?.matrix && warp.matrix.length === 9)
            ? "Recalibrate Dual Projectors"
            : "Calibrate Dual Projectors"}
        </Text>
      </Pressable>

      {warp && (
        <Pressable style={styles.danger} onPress={() => void clearAlignment()}>
          <Text style={styles.dangerText}>Clear alignment</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 48, gap: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  body: { color: "#4b5563", fontSize: 14, lineHeight: 20 },
  block: { marginTop: 8, gap: 8 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  hint: { fontSize: 12, color: "#9ca3af", marginTop: -4 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
  },
  choiceOn: {
    borderColor: brand.colors.primary,
    backgroundColor: brand.colors.primaryLight,
  },
  choiceText: { fontWeight: "600", color: "#111827", flex: 1 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  status: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
  },
  statusText: { color: "#374151", fontSize: 13 },
  warn: { color: "#b45309", fontSize: 13, lineHeight: 18 },
  error: { color: "#b91c1c", fontSize: 13, lineHeight: 18 },
  ok: { color: "#047857", fontSize: 13, lineHeight: 18 },
  primary: {
    backgroundColor: brand.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.45 },
  danger: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  dangerText: { color: "#b91c1c", fontWeight: "700" },
  cameraWrap: { flex: 1, backgroundColor: "#000" },
  cameraHud: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(0,0,0,0.62)",
    gap: 8,
  },
  hudTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hudBody: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  ghost: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostText: { color: "#fff", fontWeight: "700" },
});
