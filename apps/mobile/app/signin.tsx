import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { brand } from "../src/brand";
import { useCurrentUser } from "../src/current-user";

type Step = "email" | "code";

export default function SignInScreen() {
  const params = useLocalSearchParams<{ token?: string; code?: string; email?: string }>();
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useCurrentUser();

  const tokenFromLink = (params.token ?? params.code ?? "").toString();
  const emailFromLink = (params.email ?? "").toString();

  const [step, setStep] = useState<Step>(tokenFromLink ? "code" : "email");
  const [email, setEmail] = useState(emailFromLink);
  const [code, setCode] = useState(tokenFromLink);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace("/(tabs)/profile");
    }
  }, [isAuthenticated, isLoading, user]);

  useEffect(() => {
    if (tokenFromLink) {
      setCode(tokenFromLink);
      setStep("code");
    }
    if (emailFromLink) setEmail(emailFromLink);
  }, [tokenFromLink, emailFromLink]);

  const sendLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn("email", { email: trimmed });
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a sign-in link.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setError("Email and code are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("email", {
        email: trimmedEmail,
        code: trimmedCode,
      });
      if (!result.signingIn) {
        setError("That code did not work. Request a new one and try again.");
        return;
      }
      router.replace("/(tabs)/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>
        {step === "email" ? `Sign in to ${brand.name}` : "Check your email"}
      </Text>
      <Text style={styles.body}>
        {step === "email"
          ? "We'll email a magic link. If the link can't open this app, enter the 8-digit code instead."
          : `Enter the code we sent to ${email}, or tap the mobile magic link in the email.`}
      </Text>

      {step === "email" ? (
        <>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            onPress={() => void sendLink()}
            disabled={busy}
            style={[styles.button, { backgroundColor: brand.colors.primary }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send magic link</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            autoCapitalize="none"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            placeholder="12345678"
            style={styles.input}
            value={code}
            onChangeText={setCode}
          />
          <Pressable
            onPress={() => void verify()}
            disabled={busy}
            style={[styles.button, { backgroundColor: brand.colors.primary }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in with code</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>Use a different email</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  body: { marginTop: 8, color: "#6b7280", lineHeight: 20 },
  input: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  button: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { marginTop: 16, alignItems: "center" },
  secondaryText: { color: "#6b7280" },
  error: { marginTop: 16, color: "#dc2626" },
});
