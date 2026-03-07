import React, { useState, useEffect, useRef } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*<>[]{}|~';

/**
 * EncryptedText
 * Animates a string by cycling through random characters before revealing
 * each letter one by one from left to right — "cipher decryption" effect.
 *
 * Props:
 *   text        {string}  - The target string to reveal
 *   speed       {number}  - ms between each scramble frame (default 40)
 *   revealDelay {number}  - ms before the reveal pass starts (default 200)
 *   className   {string}  - extra CSS classes to apply to the outer span
 */
export function EncryptedText({
  text = '',
  speed = 40,
  revealDelay = 200,
  className = '',
}) {
  const [displayed, setDisplayed] = useState(() =>
    text.split('').map(() => CHARS[Math.floor(Math.random() * CHARS.length)])
  );
  const revealedRef  = useRef(0);   // how many chars are permanently revealed
  const frameRef     = useRef(null);
  const startedRef   = useRef(false);

  useEffect(() => {
    let revealIdx = 0;

    const scramble = () => {
      setDisplayed(prev =>
        prev.map((_, i) => {
          if (i < revealIdx) return text[i]; // already locked
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
      );
    };

    const revealNext = () => {
      revealIdx++;
      revealedRef.current = revealIdx;

      setDisplayed(prev =>
        prev.map((_, i) => {
          if (i < revealIdx) return text[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
      );

      if (revealIdx < text.length) {
        // Keep scrambling remaining chars while revealing
        frameRef.current = setTimeout(() => {
          scramble();
          frameRef.current = setTimeout(revealNext, speed * 2);
        }, speed);
      }
    };

    // Short initial scramble before starting reveal
    let scrambleCount = 0;
    const initialScramble = () => {
      scramble();
      scrambleCount++;
      if (scrambleCount < Math.round(revealDelay / speed)) {
        frameRef.current = setTimeout(initialScramble, speed);
      } else {
        frameRef.current = setTimeout(revealNext, speed);
      }
    };

    frameRef.current = setTimeout(initialScramble, 50);

    return () => clearTimeout(frameRef.current);
  }, [text, speed, revealDelay]);

  return (
    <span className={`font-mono ${className}`} aria-label={text}>
      {displayed.map((char, i) => (
        <span
          key={i}
          style={{
            color: i < revealedRef.current ? 'inherit' : 'rgba(0,229,255,0.6)',
            transition: 'color 0.12s',
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
