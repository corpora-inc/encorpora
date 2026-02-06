/**
 * Lightweight i18n for Juice Squeeze 2 popup text
 * Migrated from v1's translations.ts
 */

type TranslationKey =
  | "levelComplete"
  | "bottlesFilled"
  | "harderPhrasesHint"
  | "reviewPhrases"
  | "continuePlaying"
  | "advanceTo"
  | "masteredAllLevels"
  | "phrasesCompleted"
  | "noPhrases"
  | "showAnswer"
  | "buildWith"

const translations: Record<string, Record<TranslationKey, string>> = {
  en: {
    levelComplete: "Level Complete!",
    bottlesFilled: "{n} bottles filled!",
    harderPhrasesHint: "Want harder phrases? Add {level} to your Corpán stack settings",
    reviewPhrases: "Review Phrases",
    continuePlaying: "Continue Playing",
    advanceTo: "Advance to {level}",
    masteredAllLevels: "You've mastered all levels!",
    phrasesCompleted: "Phrases Completed",
    noPhrases: "No phrases recorded for this bottle",
    showAnswer: "Show Answer",
    buildWith: "Build with",
  },
  es: {
    levelComplete: "¡Nivel Completo!",
    bottlesFilled: "¡{n} botellas llenas!",
    harderPhrasesHint: "¿Quieres frases más difíciles? Añade {level} en la configuración",
    reviewPhrases: "Revisar Frases",
    continuePlaying: "Seguir Jugando",
    advanceTo: "Avanzar a {level}",
    masteredAllLevels: "¡Has dominado todos los niveles!",
    phrasesCompleted: "Frases Completadas",
    noPhrases: "No hay frases registradas para esta botella",
    showAnswer: "Mostrar Respuesta",
    buildWith: "Construir con",
  },
  fr: {
    levelComplete: "Niveau Terminé !",
    bottlesFilled: "{n} bouteilles remplies !",
    harderPhrasesHint: "Vous voulez des phrases plus difficiles ? Ajoutez {level}",
    reviewPhrases: "Revoir les Phrases",
    continuePlaying: "Continuer à Jouer",
    advanceTo: "Passer au {level}",
    masteredAllLevels: "Vous avez maîtrisé tous les niveaux !",
    phrasesCompleted: "Phrases Complétées",
    noPhrases: "Aucune phrase enregistrée pour cette bouteille",
    showAnswer: "Afficher la Réponse",
    buildWith: "Construire avec",
  },
  de: {
    levelComplete: "Level Abgeschlossen!",
    bottlesFilled: "{n} Flaschen gefüllt!",
    harderPhrasesHint: "Möchtest du schwierigere Sätze? Füge {level} hinzu",
    reviewPhrases: "Sätze Überprüfen",
    continuePlaying: "Weiterspielen",
    advanceTo: "Weiter zu {level}",
    masteredAllLevels: "Du hast alle Level gemeistert!",
    phrasesCompleted: "Abgeschlossene Sätze",
    noPhrases: "Keine Sätze für diese Flasche aufgezeichnet",
    showAnswer: "Antwort Anzeigen",
    buildWith: "Bauen mit",
  },
  ko: {
    levelComplete: "레벨 완료!",
    bottlesFilled: "{n}병 채움!",
    harderPhrasesHint: "더 어려운 문장을 원하시나요? {level}을 추가하세요",
    reviewPhrases: "문장 복습",
    continuePlaying: "계속 플레이",
    advanceTo: "{level}로 진행",
    masteredAllLevels: "모든 레벨을 마스터했습니다!",
    phrasesCompleted: "완료한 문장",
    noPhrases: "이 병에 기록된 문장이 없습니다",
    showAnswer: "정답 보기",
    buildWith: "조합",
  },
  ja: {
    levelComplete: "レベル完了！",
    bottlesFilled: "{n}本のボトルを満たしました！",
    harderPhrasesHint: "もっと難しいフレーズがほしいですか？{level}を追加してください",
    reviewPhrases: "フレーズを確認",
    continuePlaying: "プレイを続ける",
    advanceTo: "{level}に進む",
    masteredAllLevels: "すべてのレベルをマスターしました！",
    phrasesCompleted: "完了したフレーズ",
    noPhrases: "このボトルに記録されたフレーズはありません",
    showAnswer: "答えを見る",
    buildWith: "組み立て",
  },
  zh: {
    levelComplete: "级别完成！",
    bottlesFilled: "已装满{n}瓶！",
    harderPhrasesHint: "想要更难的句子吗？添加{level}",
    reviewPhrases: "复习句子",
    continuePlaying: "继续游戏",
    advanceTo: "进入{level}",
    masteredAllLevels: "你已掌握所有级别！",
    phrasesCompleted: "已完成的句子",
    noPhrases: "此瓶没有记录的句子",
    showAnswer: "显示答案",
    buildWith: "用...构建",
  },
}

/**
 * Get translated string with optional parameter substitution
 */
export const t = (key: TranslationKey, lang: string, params?: Record<string, string | number>): string => {
  const langCode = lang.split("-")[0]
  const str = translations[langCode]?.[key] || translations.en[key]
  if (!params) return str
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    str
  )
}
