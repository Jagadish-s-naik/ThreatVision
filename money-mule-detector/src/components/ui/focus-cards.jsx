import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { X, Check } from "lucide-react";

export const Card = React.memo(
  ({
    card,
    index,
    hovered,
    setHovered,
    onClick
  }) => (
    <motion.div
      layoutId={`card-${index}`}
      onMouseEnter={() => setHovered(index)}
      onMouseLeave={() => setHovered(null)}
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-white/5 relative bg-[#030303] overflow-hidden aspect-[4/3] md:aspect-auto md:h-96 w-full transition-all duration-500 ease-in-out cursor-pointer group",
        hovered !== null && hovered !== index && "blur-md scale-[0.98] opacity-60",
        hovered === index && "border-teal-500/50 shadow-[0_0_30px_rgba(45,212,191,0.2)] ring-1 ring-teal-500/20"
      )}
    >
      <motion.img
        layoutId={`image-${index}`}
        src={card.src}
        alt={card.title}
        className="object-cover absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-110"
      />
      
      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-[#030303]/40 to-transparent pointer-events-none" />

      <motion.div
        layoutId={`content-${index}`}
        className="absolute inset-0 flex flex-col justify-end p-6 md:p-8"
      >
        <motion.div 
          layoutId={`title-${index}`} 
          className={cn(
            "text-xl font-bold transition-all duration-500",
            hovered === index 
              ? "text-3xl md:text-4xl bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-200 mb-2 translate-y-0" 
              : "text-lg md:text-xl text-white drop-shadow-md translate-y-0"
          )}
        >
          {card.title}
        </motion.div>
        
        <AnimatePresence>
          {hovered === index && (
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="text-sm md:text-base text-teal-400 font-medium flex items-center gap-2"
            >
              Click to explore <span className="text-lg leading-none">&rarr;</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
);

Card.displayName = "Card";

export function FocusCards({ cards }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (selected) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [selected]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {cards.map((card, index) => (
          <Card
            key={card.title}
            card={card}
            index={index}
            hovered={hovered}
            setHovered={setHovered}
            onClick={() => setSelected({ card, index })}
          />
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#030303]/80 backdrop-blur-sm pointer-events-auto"
              onClick={() => setSelected(null)}
            />
            
            <motion.div
              layoutId={`card-${selected.index}`}
              className="relative w-full max-w-4xl bg-[#0a0c10] border border-teal-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(45,212,191,0.2)] pointer-events-auto flex flex-col md:flex-row max-h-[90vh]"
            >
              <div className="relative w-full md:w-1/2 h-64 md:h-auto overflow-hidden shrink-0">
                <motion.img
                  layoutId={`image-${selected.index}`}
                  src={selected.card.src}
                  alt={selected.card.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0c10] md:bg-gradient-to-r md:from-transparent md:to-[#0a0c10] opacity-100" />
              </div>
              
              <motion.div 
                layoutId={`content-${selected.index}`}
                className="relative p-6 md:p-10 w-full md:w-1/2 flex flex-col justify-center overflow-y-auto"
              >
                <div className="hidden">
                   {/* Dummy layout IDs to keep framer motion happy for exiting */}
                   <motion.div layoutId={`title-default-${selected.index}`} />
                </div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-6 w-fit">
                   <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                   Feature Deep Dive
                </div>

                <motion.h3 layoutId={`title-${selected.index}`} className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-4">
                  {selected.card.title}
                </motion.h3>
                
                <motion.p
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10 }}
                   transition={{ delay: 0.1 }}
                   className="text-slate-300 text-base md:text-lg leading-relaxed mb-8"
                >
                  {selected.card.desc}
                </motion.p>
                
                {selected.card.bullets && (
                  <motion.ul 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     transition={{ delay: 0.2 }}
                     className="space-y-4 mb-8"
                  >
                     {selected.card.bullets.map((bullet, i) => (
                        <li key={i} className="flex gap-3 text-sm md:text-base text-slate-300 items-start">
                           <div className="w-6 h-6 rounded bg-teal-500/10 flex items-center justify-center flex-shrink-0 border border-teal-500/20 mt-0.5">
                              <Check className="w-4 h-4 text-teal-400" />
                           </div>
                           <span className="leading-snug">{bullet}</span>
                        </li>
                     ))}
                  </motion.ul>
                )}

                <div className="mt-auto pt-4 border-t border-white/5">
                    <button 
                      onClick={() => setSelected(null)}
                      className="px-6 py-3 w-full border border-white/10 rounded-xl text-white hover:bg-white/5 hover:border-white/20 transition-all font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Close Details
                    </button>
                </div>
              </motion.div>
              
              <button 
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-white/10 backdrop-blur border border-white/10 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-all z-10"
                onClick={() => setSelected(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
