import { describe, it, expect, beforeEach } from "vitest";
import { t, setLang, getLang, initI18n } from "./index";

describe("i18n t and setLang", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("t returns en string by default and es after setLang", () => {
    setLang("en");
    expect(getLang()).toBe("en");
    expect(t("login.title")).toBe("Sign in to Watchbug");
    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("watchbug_lang")).toBe("en");

    setLang("es");
    expect(getLang()).toBe("es");
    expect(t("login.title")).toBe("Iniciar sesion en Watchbug");
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("watchbug_lang")).toBe("es");

    // fallback key
    expect(t("nonexistent.key")).toBe("nonexistent.key");

    // reset to en for other tests
    setLang("en");
  });

  it("persists to localStorage", () => {
    setLang("es");
    expect(localStorage.getItem("watchbug_lang")).toBe("es");
    setLang("en");
    expect(localStorage.getItem("watchbug_lang")).toBe("en");
  });

  it("initI18n sets document lang", () => {
    setLang("es");
    initI18n();
    expect(document.documentElement.lang).toBe("es");
    setLang("en");
    initI18n();
    expect(document.documentElement.lang).toBe("en");
  });

  it("allowlist only en/es", () => {
    setLang("en");
    // @ts-expect-error testing invalid lang
    setLang("fr");
    expect(getLang()).toBe("en");
    expect(localStorage.getItem("watchbug_lang")).toBe("en");
  });
});
