import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { z } from "zod";
import app from "./locales/es/app.json";
import assistant from "./locales/es/assistant.json";
import auth from "./locales/es/auth.json";
import common from "./locales/es/common.json";
import landing from "./locales/es/landing.json";
import organizations from "./locales/es/organizations.json";
import records from "./locales/es/records.json";
import tables from "./locales/es/tables.json";

export const defaultNS = "common";

// Adding English later means adding an `en` entry with the same namespaces.
export const resources = {
  es: { common, landing, auth, app, tables, records, organizations, assistant },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "es",
  fallbackLng: "es",
  defaultNS,
  ns: Object.keys(resources.es),
  interpolation: {
    // React already escapes rendered values.
    escapeValue: false,
  },
});

// Fallback messages for schema errors that the UI does not map to its own copy.
z.config(z.locales.es());

export default i18n;
