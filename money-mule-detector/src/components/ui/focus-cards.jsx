import React, { useState } from "react";
import { cn } from "../../lib/utils";

export const Card = React.memo(
  ({
    card,
    index,
    hovered,
    setHovered,
  }) => (
    <div
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "rounded-2xl border border-white/5 relative bg-gray-100 dark:bg-neutral-900 overflow-hidden h-60 md:h-96 w-full transition-all duration-300 ease-out cursor-pointer group",
        hovered !== null && hovered !== index && "blur-sm scale-[0.98]"
      )}
    >
      <img
        src={card.src}
        alt={card.title}
        className="object-cover absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-110"
      />
      
      {/* Gradient overlay for better text readability and styling */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent pointer-events-none" />

      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-end p-6 md:p-8 transition-opacity duration-300",
          hovered === index ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-200 mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
          {card.title}
        </div>
        <p className="text-sm md:text-base text-teal-400 font-medium translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-75">
          {card.desc}
        </p>
      </div>

      {/* Default visible title when not hovered */}
      <div
        className={cn(
          "absolute bottom-0 left-0 w-full p-6 transition-opacity duration-300",
          hovered !== null ? "opacity-0" : "opacity-100"
        )}
      >
         <div className="text-lg md:text-xl font-bold text-white drop-shadow-md">
          {card.title}
        </div>
      </div>
    </div>
  )
);

Card.displayName = "Card";

export function FocusCards({ cards }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          card={card}
          index={index}
          hovered={hovered}
          setHovered={setHovered}
        />
      ))}
    </div>
  );
}
