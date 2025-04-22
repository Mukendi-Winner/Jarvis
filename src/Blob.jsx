import React from "react";
import { motion } from "framer-motion";
import useSpeech from "./hook/useSpeech";
import { useEffect } from "react";
export default function Blob() {

  const speak = useSpeech("Bonjour, je suis ton assistant Blob !");
  useEffect(() => {
    speak();
  }, []);

  const blobPaths = [
    "M450,300Q490,450,300,450Q110,450,150,300Q190,150,300,150Q410,150,450,300Z",
    "M440,310Q460,460,300,440Q140,420,170,300Q200,180,300,170Q400,160,440,310Z",
    "M460,290Q490,440,310,460Q130,480,140,300Q150,120,300,140Q450,160,460,290Z",
    "M430,320Q420,470,300,430Q180,390,200,300Q220,210,300,190Q380,170,430,320Z"
  ];

  return (
<div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
<div className="w-[140vmin] h-[140vmin] flex items-center justify-center">
        <motion.svg
          viewBox="0 0 600 600"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          <defs>
            <radialGradient id="blobGradient" cx="45%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#6d28d9" />
              <stop offset="50%" stopColor="#4338ca" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </radialGradient>
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -8" />
            </filter>
          </defs>

          <motion.path
            fill="url(#blobGradient)"
            filter="url(#goo)"
            initial={{ d: blobPaths[0] }}
            animate={{ d: blobPaths }}
            transition={{
              duration: 18,
              ease: [0.6, 0.05, 0.4, 0.99],
              repeat: Infinity,
              repeatType: "reverse"
            }}
          />
        </motion.svg>
      </div>
    </div>
  );
}
