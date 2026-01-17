import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export type BadgeVariant = "new" | "update" | "installed" | "offline"

export function PackBadge({
  variant,
  className,
}: {
  variant: BadgeVariant
  className?: string
}) {
  const { t } = useTranslation()
  const variants: Record<
    BadgeVariant,
    { label: string; className: string }
  > = {
    new: {
      label: t("packs.new"),
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    update: {
      label: t("packs.update"),
      className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
    installed: {
      label: t("packs.installed"),
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    offline: {
      label: t("packs.offline"),
      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
  }

  const config = variants[variant]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
