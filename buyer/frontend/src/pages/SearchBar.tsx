// components/search/AnimatedSearchBar.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import logo from "../../public/Park_your_Vehicle_log.png?url";

interface AnimatedSearchBarProps {
  onOpen?: () => void;
}

export function AnimatedSearchBar({ onOpen }: AnimatedSearchBarProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    navigate("/my-spaces");
  };

  return (
    <motion.div
      className="w-full max-w-5xl mx-auto px-6"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, type: "spring" }}
    >
      {/* Main Search Container */}
      <motion.div
        onClick={handleClick}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="w-full h-20 bg-white/95 backdrop-blur-md rounded-2xl 
                   shadow-2xl border-2 border-white/60 cursor-pointer 
                   overflow-hidden group relative"
        animate={{
          y: isHovered ? -3 : 0,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{ type: "spring", stiffness: 400 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Animated Gradient Border */}
        <motion.div
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500 via-red-400 to-red-500 opacity-0 group-hover:opacity-100"
          animate={{
            backgroundPosition: isHovered ? ["0%", "100%", "0%"] : "0%",
          }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            backgroundSize: "200% 200%",
          }}
        />
        
        {/* White Background */}
        <div className="absolute inset-0.5 rounded-2xl bg-white/95 backdrop-blur-md" />

        {/* Content */}
        <div className="relative z-10 h-full flex items-center justify-between px-8">
          
          {/* Logo */}
          <motion.div
            className="flex-shrink-0"
            animate={{ scale: isHovered ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <img 
              src={logo} 
              alt="logo" 
              className="h-14 w-14 drop-shadow-md"
            />
          </motion.div>

          {/* Text */}
          <div className="flex-1 text-center">
            <motion.span
              className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
              animate={{ 
                backgroundPosition: isHovered ? ["0%", "100%"] : "0%",
              }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                backgroundSize: "200% 200%",
              }}
            >
              Find your perfect parking...
            </motion.span>
          </div>

          {/* Search Button */}
          <motion.button
            className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 
                       text-white rounded-xl font-semibold shadow-lg"
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 10px 30px -5px rgba(239, 68, 68, 0.5)"
            }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            <Search className="w-5 h-5" />
            <span>Search</span>
          </motion.button>
        </div>

        {/* Bottom Glow Effect */}
        <motion.div
          className="absolute bottom-0 left-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full"
          animate={{
            scale: isHovered ? 1.2 : 0.8,
            opacity: isHovered ? 1 : 0.6,
          }}
          transition={{ type: "spring", stiffness: 400 }}
        />
      </motion.div>
    </motion.div>
  );
}

export default AnimatedSearchBar;