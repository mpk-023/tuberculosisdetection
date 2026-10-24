(() => {
  const languages = [
    ["en", "English"], ["hi", "हिन्दी"], ["ta", "தமிழ்"], ["te", "తెలుగు"],
    ["kn", "ಕನ್ನಡ"], ["ml", "മലയാളം"], ["mr", "मराठी"], ["bn", "বাংলা"],
    ["gu", "ગુજરાતી"], ["pa", "ਪੰਜਾਬੀ"], ["or", "ଓଡ଼ିଆ"], ["ur", "اردو"],
  ];
  const en = window.TBTAEn;
  const translations = Object.fromEntries(languages.map(([code]) => [
    code, code === "hi" ? window.TBTAHi : code === "ta" ? window.TBTATa : { ...en },
  ]));
  window.TBTALocales = { languages, en, translations };
})();
