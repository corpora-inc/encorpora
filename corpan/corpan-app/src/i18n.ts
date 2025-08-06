import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";

export const defaultNS = "common";

i18n
  // load translation using http -> see /public/locales (i.e. https://github.com/i18next/i18next-http-backend)
  .use(Backend)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    fallbackLng: "en", // use 'en' if the user's language is not available
    debug: true,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },

    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    ns: ["common"],
    defaultNS,
  });

export default i18n;
