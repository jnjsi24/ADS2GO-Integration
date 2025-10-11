import React, { useRef, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";

interface LogoItem {
  src: string;
  alt: string;
  href?: string;
}

interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number; // lower = faster
  gap?: number;
  pauseOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
}

const LogoLoop: React.FC<LogoLoopProps> = ({
  logos,
  speed = 50,
  gap = 40,
  pauseOnHover = true,
  fadeOut = true,
  fadeOutColor = "#ffffff",
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();

  useEffect(() => {
    const animate = async () => {
      await controls.start({
        x: ["0%", "-50%"], // move halfway (duplicated logos)
        transition: {
          ease: "linear",
          duration: speed,
          repeat: Infinity,
        },
      });
    };
    animate();
  }, [controls, speed]);

  const handleMouseEnter = () => pauseOnHover && controls.stop();
  const handleMouseLeave = () =>
    controls.start({
      x: ["0%", "-50%"],
      transition: {
        ease: "linear",
        duration: speed,
        repeat: Infinity,
      },
    });

  return (
    <div
      className="relative overflow-hidden h-[150px] flex items-center"
      style={{
        "--fadeColor": fadeOutColor,
      } as React.CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {fadeOut && (
        <>
          <div className="pointer-events-none absolute left-0 inset-y-0 w-[80px] bg-gradient-to-r from-[var(--fadeColor)] to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 inset-y-0 w-[80px] bg-gradient-to-l from-[var(--fadeColor)] to-transparent z-10" />
        </>
      )}

      {/* Animation track */}
      <motion.div
        ref={trackRef}
        animate={controls}
        className="flex items-center gap-10 w-max"
      >
        {/* Duplicate logos twice for infinite loop */}
        {[...logos, ...logos].map((logo, i) => (
          <a
            key={i}
            href={logo.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img
              src={logo.src}
              alt={logo.alt}
              className="h-16 w-auto hover:scale-110 transition-transform duration-300"
            />
          </a>
        ))}
      </motion.div>
    </div>
  );
};

export default LogoLoop;
