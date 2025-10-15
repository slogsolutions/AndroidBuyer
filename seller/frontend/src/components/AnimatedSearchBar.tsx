import React, { useState } from "react";
import { Search } from "lucide-react";

interface AnimatedSearchBarProps {
  onSearch?: (query: string) => void;
}

const AnimatedSearchBar: React.FC<AnimatedSearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center bg-white rounded-full shadow-md px-4 py-2 w-full max-w-md transition-all duration-300 focus-within:shadow-lg"
    >
      <Search className="text-gray-500 mr-2" size={20} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for parking..."
        className="w-full outline-none bg-transparent text-gray-700"
      />
    </form>
  );
};

export default AnimatedSearchBar;
