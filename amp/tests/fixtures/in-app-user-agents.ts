import type { BrowserKind } from "../../src/analytics/browser-kind";

// Real-world UA samples from UAParser.js browser fixtures (accessed 2026-11-14):
// https://github.com/faisalman/ua-parser-js/tree/master/test/data/ua/browser
// Each name identifies the source JSON file and zero-based sample index.
export const userAgents: { name: string; kind: BrowserKind; ua: string }[] = [
  {
    name: "facebook-0",
    kind: "inapp-facebook",
    ua: "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/43.0.2357.121 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/35.0.0.48.273;]",
  },
  {
    name: "facebook-1",
    kind: "inapp-facebook",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Mobile/14E304 [FBAN/FBIOS;FBAV/91.0.0.41.73;FBBV/57050710;FBDV/iPhone8,1;FBMD/iPhone;FBSN/iOS;FBSV/10.3.1;FBSS/2;FBCR/Telekom.de;FBID/phone;FBLC/de_DE;FBOP/5;FBRV/0])",
  },
  {
    name: "instagram-0",
    kind: "inapp-instagram",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 142.0.0.22.109 (iPhone12,5; iOS 14_1; en_US; en-US; scale=3.00; 1242x2688; 214888322) NW/1",
  },
  {
    name: "tiktok-0",
    kind: "inapp-tiktok",
    ua: "Mozilla/5.0 (Linux; Android 11; 21061119AG Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/92.0.4515.131 Mobile Safari/537.36 trill_2022109040 JsSdk/1.0 NetType/MOBILE Channel/googleplay AppName/musical_ly app_version/21.9.4 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/KG BytedanceWebview/d8a21c6",
  },
  {
    name: "tiktok-1",
    kind: "inapp-tiktok",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_21.1.0 JsSdk/2.0 NetType/4G Channel/App Store ByteLocale/ru Region/RU ByteFullLocale/ru-RU isDarkMode/1 WKWebView/1 BytedanceWebview/d8a21c6",
  },
  {
    name: "linkedin-0",
    kind: "inapp-other",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]",
  },
  {
    name: "snapchat-0",
    kind: "inapp-snapchat",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Snapchat/12.33.0.36 (like Safari/8614.1.25.0.31, panda)",
  },
  {
    name: "line-0",
    kind: "inapp-other",
    ua: "Mozilla/5.0 (Linux; Android 5.0; ASUS_Z00AD Build/LRX21V; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/51.0.2704.81 Mobile Safari/537.36 Line/6.5.1/IAB",
  },
  {
    name: "line-1",
    kind: "inapp-other",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 11_2_6 like Mac OS X) AppleWebKit/604.5.6 (KHTML, like Gecko) Mobile/15D100 Safari Line/8.4.1",
  },
  {
    name: "mobile-safari-0",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_0 like Mac OS X; en-us) AppleWebKit/532.9 (KHTML, like Gecko) Version/4.0.5 Mobile/8A293 Safari/6531.22.7",
  },
  {
    name: "mobile-safari-1",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)  Mobile/15E148 Safari/604.1",
  },
  {
    name: "mobile-chrome-0",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; U; CPU iPhone OS 5_1_1 like Mac OS X; en) AppleWebKit/534.46.0 (KHTML, like Gecko) CriOS/19.0.1084.60 Mobile/9B206 Safari/7534.48.3",
  },
  {
    name: "mobile-chrome-1",
    kind: "standard",
    ua: "Mozilla/5.0 (Linux; U; Android-4.0.3; en-us; Galaxy Nexus Build/IML74K) AppleWebKit/535.7 (KHTML, like Gecko) CrMo/16.0.912.75 Mobile Safari/535.7",
  },
  {
    name: "mobile-firefox-0",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) FxiOS/1.1 Mobile/13B143 Safari/601.1.46",
  },
  {
    name: "mobile-firefox-1",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/112.0 Mobile/15E148 Safari/605.1.15",
  },
  {
    name: "edge-0",
    kind: "standard",
    ua: "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0",
  },
  {
    name: "edge-1",
    kind: "standard",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/17.17134",
  },
  {
    name: "edge-4",
    kind: "standard",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 EdgiOS/42.1.1.0 Mobile/15F79 Safari/605.1.15",
  },
  {
    name: "edge-5",
    kind: "standard",
    ua: "Mozilla/5.0 (Linux; Android 8.0.0; G8441 Build/47.1.A.12.270) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.123 Mobile Safari/537.36 EdgA/42.0.0.2529",
  },
  {
    name: "samsung-internet-0",
    kind: "standard",
    ua: "Mozilla/5.0 (Linux; Android 5.0.2; SAMSUNG SM-G925F Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/3.0 Chrome/38.0.2125.102 Mobile Safari/537.36",
  },
  {
    name: "samsung-internet-1",
    kind: "standard",
    ua: "Mozilla/5.0 (Linux; Android 6.0.1; SAMSUNG-SM-G925A Build/MMB29K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/4.0 Chrome/44.0.2403.133 Mobile Safari/537.36",
  },
  // https://github.com/browserslist/browserslist-useragent/issues/25
  {
    name: "messenger-android",
    kind: "inapp-facebook",
    ua: "Mozilla/5.0 (Linux; Android 8.0.0; LG-H930 Build/OPR1.170623.026; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/69.0.3497.100 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/189.0.0.27.99;]",
  },
  // https://github.com/matomo-org/device-detector/issues/5646
  {
    name: "messenger-ios",
    kind: "inapp-facebook",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_3 like Mac OS X) AppleWebKit/603.3.8 (KHTML, like Gecko) Mobile/14G60 [FBAN/MessengerForiOS;FBAV/132.0.0.41.90;FBBV/69171754;FBDV/iPhone8,4;FBMD/iPhone;FBSN/iOS;FBSV/10.3.3;FBSS/2;FBCR/Koodo;FBID/phone;FBLC/en_US;FBOP/5;FBRV/0]",
  },
];
