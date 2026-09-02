"use client";

import { useEffect } from "react";

export default function HeadCaseClient() {
  useEffect(() => {
    const form = document.getElementById("signup-form") as HTMLFormElement | null;
    const successEl = document.getElementById("form-success");
    const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement | null;

    // --- Section reveal ---
    const selectors = [
      "#what .order-2",
      "#what .media-frame",
      "#experience .mx-auto.max-w-2xl",
      ".xp-item",
      "#experience .media-frame--wide",
      ".signup-panel",
    ];
    const revealTargets = document.querySelectorAll(selectors.join(","));
    revealTargets.forEach((el) => el.classList.add("fade-up"));

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.16, rootMargin: "0px 0px -40px 0px" },
      );
      revealTargets.forEach((el) => io!.observe(el));
    } else {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
    }

    // --- Smooth scroll for anchor links ---
    const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]');
    const clickHandlers: Array<{ el: HTMLAnchorElement; fn: (e: Event) => void }> = [];
    anchors.forEach((anchor) => {
      const fn = (e: Event) => {
        const id = anchor.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.pushState(null, "", id);
      };
      anchor.addEventListener("click", fn);
      clickHandlers.push({ el: anchor, fn });
    });

    // --- Form validation + submit ---
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const setError = (input: HTMLElement | null, errorEl: HTMLElement | null, message: string) => {
      if (!input || !errorEl) return;
      if (message) {
        input.setAttribute("aria-invalid", "true");
        errorEl.hidden = false;
        errorEl.textContent = message;
      } else {
        input.removeAttribute("aria-invalid");
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
    };

    const validate = () => {
      const nameInput = document.getElementById("name") as HTMLInputElement | null;
      const emailInput = document.getElementById("email") as HTMLInputElement | null;
      const nameError = document.getElementById("name-error");
      const emailError = document.getElementById("email-error");

      let valid = true;
      const name = (nameInput?.value || "").trim();
      const email = (emailInput?.value || "").trim();

      if (name.length < 2) {
        setError(nameInput, nameError, "Drop a name — at least 2 characters.");
        valid = false;
      } else {
        setError(nameInput, nameError, "");
      }

      if (!email) {
        setError(emailInput, emailError, "We need an email to send the goods.");
        valid = false;
      } else if (!emailPattern.test(email)) {
        setError(emailInput, emailError, "That email looks off. Try again?");
        valid = false;
      } else {
        setError(emailInput, emailError, "");
      }

      return { valid, name, email };
    };

    const inputHandlers: Array<{ el: HTMLInputElement; fn: () => void }> = [];
    ["name", "email"].forEach((id) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (!input) return;
      const fn = () => {
        if (input.getAttribute("aria-invalid") === "true") validate();
      };
      input.addEventListener("input", fn);
      inputHandlers.push({ el: input, fn });
    });

    const onSubmit = async (e: Event) => {
      e.preventDefault();
      const { valid, name, email } = validate();
      if (!valid) {
        const firstInvalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
        firstInvalid?.focus();
        return;
      }

      submitBtn?.classList.add("is-loading");
      const label = submitBtn?.querySelector(".btn-label");
      if (label) label.textContent = "Tuning in…";

      await new Promise((resolve) => setTimeout(resolve, 550));

      try {
        const existing = JSON.parse(localStorage.getItem("headCaseWaitlist") || "[]");
        existing.push({ name, email, joinedAt: new Date().toISOString() });
        localStorage.setItem("headCaseWaitlist", JSON.stringify(existing));
      } catch {
        // Storage may be blocked; still show success
      }

      form?.classList.add("is-success");
      if (successEl) successEl.hidden = false;
      form?.reset();
      submitBtn?.classList.remove("is-loading");
    };

    form?.addEventListener("submit", onSubmit);

    // --- Cleanup ---
    return () => {
      io?.disconnect();
      clickHandlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
      inputHandlers.forEach(({ el, fn }) => el.removeEventListener("input", fn));
      form?.removeEventListener("submit", onSubmit);
    };
  }, []);

  return null;
}
