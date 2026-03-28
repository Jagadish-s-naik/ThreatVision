"use client";
import React from "react";
import { motion } from "framer-motion";

export const TimelineContent = ({
  children,
  animationNum = 0,
  customVariants,
  as = "div",
  className,
  ...props
}) => {
  const Component = motion[as] || motion.div;
  
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={customVariants}
      custom={animationNum}
      {...props}
    >
      {children}
    </Component>
  );
};
