import React from 'react';
import { Film, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-[#080c14] border-t border-gray-800/60 py-10 mt-20 text-gray-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-red-600 flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              Cine<span className="text-red-500">Book</span>
            </span>
            <span className="text-gray-500 text-xs ml-2">© {new Date().getFullYear()} CineBook Inc.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
            <span className="hover:text-gray-200 transition cursor-pointer">Terms & Conditions</span>
            <span className="hover:text-gray-200 transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-gray-200 transition cursor-pointer">Security & Payments</span>
            <span className="hover:text-gray-200 transition cursor-pointer">Help Center</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Engineered with</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>for cinema lovers</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
