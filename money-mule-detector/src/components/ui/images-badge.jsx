"use client";

import React, { useState } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";

export function ImagesBadge({ text, images }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div 
      className="flex items-center gap-4 cursor-pointer group px-4 py-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Folder Icon Container */}
      <div className="relative w-16 h-12 flex items-end justify-center shrink-0">
        
        {/* Back of folder (with tab) */}
        <div 
          className="absolute inset-0 bg-indigo-500 rounded-md shadow-sm" 
          style={{ clipPath: "polygon(0 0, 35% 0, 45% 20%, 100% 20%, 100% 100%, 0 100%)" }} 
        />
        
        {/* Animated Stacked Images */}
        {images.map((img, idx) => {
          // Define fan-out animation positions
          const fanOutY = [-40, -50, -40];
          const fanOutX = [-35, 0, 35];
          const fanOutRotate = [-15, -2, 15];
          
          return (
            <motion.div
              key={idx}
              className="absolute bottom-1 w-12 h-8 rounded-[3px] bg-white border border-gray-200/20 shadow-xl overflow-hidden pointer-events-none"
              initial={false}
              animate={
                hovered
                  ? { 
                      y: fanOutY[idx], 
                      x: fanOutX[idx], 
                      rotate: fanOutRotate[idx], 
                      scale: 1.25,
                      zIndex: 10 + idx,
                      opacity: 1
                    }
                  : { 
                      y: -10, // Peek out slightly from the folder
                      x: 0, 
                      rotate: 0, 
                      scale: 1,
                      zIndex: 10,
                      opacity: idx === images.length - 1 ? 1 : 0 // Only show top paper when unhovered
                    }
              }
              transition={{ 
                duration: 0.3, 
                ease: "easeOut",
                delay: hovered ? idx * 0.04 : 0 // slight stagger out, snap back in
              }}
            >
              <img src={img} alt={`file-${idx}`} className="w-full h-full object-cover" />
            </motion.div>
          );
        })}

        {/* Front of folder */}
        <div className="absolute bottom-0 w-full h-8 bg-teal-500 rounded-md shadow-inner z-20" />
      </div>

      {/* Text perfectly aligned horizontally */}
      {text && (
        <span className="text-slate-100 font-semibold text-lg md:text-xl tracking-wide">
          {text}
        </span>
      )}
    </div>
  );
}
