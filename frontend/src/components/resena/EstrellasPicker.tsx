"use client"
import { useState } from "react"
import { Star } from "lucide-react"

interface Props {
  value: number
  onChange: (v: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
}

const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" }

export function EstrellasPicker({ value, onChange, readonly = false, size = "md" }: Props) {
  const [hover, setHover] = useState(0)
  const iconClass = sizes[size]

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconClass} transition-colors ${
            star <= (hover || value) ? "text-accent-500 fill-accent-500" : "text-gray-300"
          } ${!readonly ? "cursor-pointer hover:scale-110" : ""}`}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange(star)}
        />
      ))}
    </div>
  )
}
