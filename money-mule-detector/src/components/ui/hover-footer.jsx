"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import {
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Twitter,
  Globe,
  Shield,
  Github,
} from "lucide-react";

export const TextHoverEffect = ({
  text,
  duration,
  automatic,
  className,
}) => {
  const svgRef = useRef(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 500 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className={cn("select-none uppercase cursor-pointer", className)}
    >
      <defs>
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="25%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="75%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-white/10 font-[helvetica] text-4xl sm:text-6xl font-bold"
        style={{ opacity: hovered ? 0.7 : 0 }}
      >
        {text}
      </text>
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-teal-500/50 font-[helvetica] text-4xl sm:text-6xl font-bold"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#textGradient)"
        strokeWidth="0.3"
        mask="url(#textMask)"
        className="fill-transparent font-[helvetica] text-4xl sm:text-6xl font-bold"
      >
        {text}
      </text>
    </svg>
  );
};

export const FooterBackgroundGradient = () => {
  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(125% 125% at 50% 10%, #0a0c10 50%, rgba(45, 212, 191, 0.15) 100%)",
      }}
    />
  );
};

export function HoverFooter() {
  // Footer link data
  const footerLinks = [
    {
      title: "Platform",
      links: [
        { label: "Mule Detection", href: "#" },
        { label: "Entity Tracing", href: "#" },
        { label: "Network Analysis", href: "#" },
        { label: "API Integration", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "Case Studies", href: "#" },
        {
          label: "Live Demo",
          href: "#",
          pulse: true,
        },
      ],
    },
  ];

  // Contact info data
  const contactInfo = [
    {
      icon: <Mail size={18} className="text-teal-400" />,
      text: "contact@threatvision.ai",
      href: "mailto:contact@threatvision.ai",
    },
    {
      icon: <Phone size={18} className="text-teal-400" />,
      text: "+1 (800) 123 XX21",
      href: "tel:+1800123xx21",
    },
    {
      icon: <MapPin size={18} className="text-teal-400" />,
      text: "San Francisco, CA",
    },
  ];

  // Social media icons
  const socialLinks = [
    { 
      icon: <Linkedin size={24} />, 
      label: "LinkedIn", 
      href: "https://www.linkedin.com/in/jagadishnaik" 
    },
    { 
      icon: <Github size={24} />, 
      label: "GitHub", 
      href: "https://github.com/Jagadish-s-naik/ThreatVision" 
    },
    { 
      icon: <Twitter size={24} />, 
      label: "Twitter", 
      href: "#" 
    },
  ];

  return (
    <footer className="bg-[#0f1115] relative overflow-hidden border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16 z-40 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-8 lg:gap-16 pb-12">
          {/* Brand section */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <Shield className="text-teal-400 w-8 h-8" />
              <span className="text-white text-2xl font-bold tracking-tight">ThreatVision</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Advanced AI-powered fraud detection and money mule network analysis for modern financial institutions.
            </p>
          </div>

          {/* Footer link sections */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="text-white text-lg font-semibold mb-6">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label} className="relative w-fit">
                    <a
                      href={link.href}
                      className="text-slate-400 hover:text-teal-400 transition-colors text-sm font-medium"
                    >
                      {link.label}
                    </a>
                    {link.pulse && (
                      <span className="absolute top-1 right-[-12px] w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact section */}
          <div>
            <h4 className="text-white text-lg font-semibold mb-6">
              Contact Us
            </h4>
            <ul className="space-y-4">
              {contactInfo.map((item, i) => (
                <li key={i} className="flex items-center space-x-3 text-sm font-medium text-slate-400">
                  {item.icon}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="hover:text-teal-400 transition-colors"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span className="hover:text-teal-400 transition-colors">
                      {item.text}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="border-t border-white/10 my-8" />

        {/* Footer bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center text-sm space-y-4 md:space-y-0">
          {/* Social icons */}
          <div className="flex space-x-6 text-slate-500">
            {socialLinks.map(({ icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-teal-400 transition-colors"
              >
                {icon}
              </a>
            ))}
          </div>

          {/* Copyright */}
          <p className="text-center md:text-left text-slate-500 font-medium">
            &copy; {new Date().getFullYear()} ThreatVision AI. All rights reserved.
          </p>
        </div>
      </div>

      {/* Text hover effect fixed */}
      <div className="flex w-full h-[10rem] md:h-[18rem] -mt-10 md:-mt-16 -mb-16 md:-mb-24 overflow-hidden pointer-events-auto relative z-20">
        <TextHoverEffect text="THREATVISION" className="w-full h-full" />
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}

export default HoverFooter;
